#pragma once

#include <optional>
#include <string>
#include <utility>
#include <variant>

namespace forgedesk
{
enum class ErrorCode
{
    invalid_argument,
    not_found,
    duplicate,
    unsupported,
    io,
    malformed,
    busy,
    closed,
    cancelled,
    internal
};

struct Error
{
    ErrorCode code;
    std::string message;
};

/// Exactly one value or error. Accessors return null for the inactive alternative.
template <typename T> class Result
{
  public:
    static Result success(T value)
    {
        return Result(std::in_place_index<0>, std::move(value));
    }
    static Result failure(Error error)
    {
        return Result(std::in_place_index<1>, std::move(error));
    }

    explicit operator bool() const noexcept
    {
        return data_.index() == 0;
    }
    T* value() noexcept
    {
        return std::get_if<0>(&data_);
    }
    const T* value() const noexcept
    {
        return std::get_if<0>(&data_);
    }
    const Error* error() const noexcept
    {
        return std::get_if<1>(&data_);
    }

  private:
    template <std::size_t I, typename U>
    Result(std::in_place_index_t<I> index, U&& value) : data_(index, std::forward<U>(value))
    {
    }
    std::variant<T, Error> data_;
};

template <> class Result<void>
{
  public:
    static Result success()
    {
        return Result(std::nullopt);
    }
    static Result failure(Error error)
    {
        return Result(std::move(error));
    }

    explicit operator bool() const noexcept
    {
        return !error_;
    }
    const Error* error() const noexcept
    {
        return error_ ? &*error_ : nullptr;
    }

  private:
    explicit Result(std::optional<Error> error) : error_(std::move(error)) {}
    std::optional<Error> error_;
};
} // namespace forgedesk
