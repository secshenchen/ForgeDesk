#pragma once

#include "forgedesk/result.hpp"
#include "forgedesk/types.hpp"

#include <chrono>
#include <condition_variable>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <stop_token>
#include <thread>
#include <vector>

namespace forgedesk
{
enum class TaskState
{
    queued,
    running,
    succeeded,
    failed,
    cancelled
};

struct TaskSnapshot
{
    TaskState state = TaskState::queued;
    unsigned progress = 0;
    std::optional<Error> error;
};

/// Valid only during the synchronous task body. Report progress in [0, 100].
struct TaskContext
{
    std::stop_token stop;
    std::function<void(unsigned)> report_progress;
};

/// Bounded worker pool. Shutdown/destruction run on a single external owner thread.
class TaskManager
{
  public:
    using Work = std::function<Result<void>(TaskContext&)>;

    explicit TaskManager(std::size_t workers, std::size_t max_queued = 128);
    ~TaskManager();
    TaskManager(const TaskManager&) = delete;
    TaskManager& operator=(const TaskManager&) = delete;

    [[nodiscard]] Result<TaskId> submit(Work work);
    [[nodiscard]] Result<TaskSnapshot> snapshot(TaskId id) const;
    /// Waits for a terminal state, or returns busy at timeout.
    [[nodiscard]] Result<TaskSnapshot> wait(TaskId id, std::chrono::milliseconds timeout);
    [[nodiscard]] Result<void> cancel(TaskId id);
    /// Releases a terminal snapshot once the caller no longer needs it.
    [[nodiscard]] Result<void> forget(TaskId id);
    /// Stops admission, cancels queued work, requests cooperative stop, and joins workers.
    void shutdown();

  private:
    struct Task
    {
        explicit Task(Work operation) : work(std::move(operation)) {}
        Work work;
        TaskSnapshot snapshot;
        std::stop_source stop;
        bool cancel_requested = false;
    };

    void run(std::stop_token stop);

    std::size_t max_queued_;
    mutable std::mutex mutex_;
    std::condition_variable_any changed_;
    std::map<TaskId, std::shared_ptr<Task>> tasks_;
    std::deque<std::shared_ptr<Task>> pending_;
    TaskId next_{1};
    bool closed_ = false;
    std::stop_source closing_;
    std::vector<std::jthread> workers_;
};
} // namespace forgedesk
