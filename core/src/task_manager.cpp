#include "forgedesk/task_manager.hpp"

#include <algorithm>
#include <stdexcept>

namespace forgedesk
{
namespace
{
bool terminal(TaskState state)
{
    return state != TaskState::queued && state != TaskState::running;
}

Error unknown_task()
{
    return {ErrorCode::not_found, "Task ID not found"};
}
} // namespace

TaskManager::TaskManager(std::size_t workers, std::size_t max_queued) : max_queued_(max_queued)
{
    if (workers == 0 || workers > 64 || max_queued == 0)
    {
        throw std::invalid_argument("Invalid worker or queue limit");
    }
    workers_.reserve(workers);
    for (std::size_t i = 0; i < workers; ++i)
    {
        workers_.emplace_back([this](std::stop_token stop) { run(stop); });
    }
}

TaskManager::~TaskManager()
{
    shutdown();
}

Result<TaskId> TaskManager::submit(Work work)
{
    if (!work)
    {
        return Result<TaskId>::failure({ErrorCode::invalid_argument, "Task body is empty"});
    }
    auto task = std::make_shared<Task>(std::move(work));
    std::lock_guard lock{mutex_};
    if (closed_)
    {
        return Result<TaskId>::failure({ErrorCode::closed, "Task manager is closed"});
    }
    if (pending_.size() >= max_queued_ || next_.value == 0)
    {
        return Result<TaskId>::failure({ErrorCode::busy, "Task admission limit reached"});
    }
    const auto id = next_;
    tasks_.emplace(id, task);
    try
    {
        pending_.push_back(task);
    }
    catch (...)
    {
        tasks_.erase(id);
        throw;
    }
    ++next_.value;
    changed_.notify_all();
    return Result<TaskId>::success(id);
}

Result<TaskSnapshot> TaskManager::snapshot(TaskId id) const
{
    std::lock_guard lock{mutex_};
    const auto it = tasks_.find(id);
    if (it == tasks_.end())
    {
        return Result<TaskSnapshot>::failure(unknown_task());
    }
    return Result<TaskSnapshot>::success(it->second->snapshot);
}

Result<TaskSnapshot> TaskManager::wait(TaskId id, std::chrono::milliseconds timeout)
{
    std::unique_lock lock{mutex_};
    const auto it = tasks_.find(id);
    if (it == tasks_.end())
    {
        return Result<TaskSnapshot>::failure(unknown_task());
    }
    const auto task = it->second;
    if (!changed_.wait_for(lock, timeout, [&] { return terminal(task->snapshot.state); }))
    {
        return Result<TaskSnapshot>::failure({ErrorCode::busy, "Task has not completed"});
    }
    return Result<TaskSnapshot>::success(task->snapshot);
}

Result<void> TaskManager::cancel(TaskId id)
{
    std::shared_ptr<Task> task;
    Work abandoned;
    {
        std::lock_guard lock{mutex_};
        const auto it = tasks_.find(id);
        if (it == tasks_.end())
        {
            return Result<void>::failure(unknown_task());
        }
        task = it->second;
        if (terminal(task->snapshot.state))
        {
            return Result<void>::failure({ErrorCode::invalid_argument, "Task is already complete"});
        }
        task->cancel_requested = true;
        if (task->snapshot.state == TaskState::queued)
        {
            std::erase(pending_, task);
            abandoned = std::move(task->work);
            task->snapshot.state = TaskState::cancelled;
        }
    }
    task->stop.request_stop();
    changed_.notify_all();
    return Result<void>::success();
}

Result<void> TaskManager::forget(TaskId id)
{
    std::lock_guard lock{mutex_};
    const auto it = tasks_.find(id);
    if (it == tasks_.end())
    {
        return Result<void>::failure(unknown_task());
    }
    if (!terminal(it->second->snapshot.state))
    {
        return Result<void>::failure({ErrorCode::busy, "Task is still active"});
    }
    tasks_.erase(it);
    return Result<void>::success();
}

void TaskManager::shutdown()
{
    std::deque<std::shared_ptr<Task>> abandoned;
    {
        std::lock_guard lock{mutex_};
        if (closed_)
        {
            return;
        }
        closed_ = true;
        pending_.swap(abandoned);
        for (const auto& task : abandoned)
        {
            task->snapshot.state = TaskState::cancelled;
        }
    }
    changed_.notify_all();
    closing_.request_stop();
    for (auto& worker : workers_)
    {
        worker.join();
    }
    for (const auto& task : abandoned)
    {
        task->work = {};
    }
}

void TaskManager::run(std::stop_token stop)
{
    while (true)
    {
        std::shared_ptr<Task> task;
        {
            std::unique_lock lock{mutex_};
            changed_.wait(lock, stop, [&] { return closed_ || !pending_.empty(); });
            if (closed_ || stop.stop_requested())
            {
                return;
            }
            task = std::move(pending_.front());
            pending_.pop_front();
            task->snapshot.state = TaskState::running;
        }
        const std::stop_callback stop_on_close{closing_.get_token(),
                                               [&] { task->stop.request_stop(); }};
        auto work = std::move(task->work);
        std::optional<Error> error;
        try
        {
            if (!task->stop.stop_requested())
            {
                TaskContext context{task->stop.get_token(), [&](unsigned progress)
                                    {
                                        std::lock_guard lock{mutex_};
                                        task->snapshot.progress = std::max(
                                            task->snapshot.progress, std::min(progress, 100U));
                                    }};
                const auto result = work(context);
                if (!result)
                {
                    error = result.error() ? *result.error()
                                           : Error{ErrorCode::internal, "Invalid result"};
                }
            }
        }
        catch (const std::exception& ex)
        {
            error = Error{ErrorCode::internal, ex.what()};
        }
        catch (...)
        {
            error = Error{ErrorCode::internal, "Task threw an unknown exception"};
        }
        {
            std::lock_guard lock{mutex_};
            auto& snapshot = task->snapshot;
            if (closed_ || task->cancel_requested)
            {
                snapshot.state = TaskState::cancelled;
            }
            else if (error)
            {
                snapshot.state = TaskState::failed;
                snapshot.error = std::move(error);
            }
            else
            {
                snapshot.state = TaskState::succeeded;
                snapshot.progress = 100;
            }
        }
        changed_.notify_all();
    }
}
} // namespace forgedesk
