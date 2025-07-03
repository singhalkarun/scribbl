package repositories

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID        int64     `json:"id"`
	Phone     string    `json:"phone"`
	Name      *string   `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserRepository handles all user-related data operations
type UserRepository interface {
	CreateUserIfNotExists(phone string) (*User, error)
	GetUserByPhone(phone string) (*User, error)
	UpdateUserName(phone, name string) (*User, error)
	DeleteUser(phone string) error // For future extensibility
}

// OTPRepository handles OTP storage and verification
type OTPRepository interface {
	StoreOTP(phone, otp string, expireAt time.Time) error
	VerifyOTP(phone, otp string) bool
	InvalidateOTP(phone string) error                  // For cleanup
	GetOTPInfo(phone string) (string, time.Time, bool) // For testing and debugging
	GetOTPTTL(phone string) (time.Duration, error)     // For monitoring and debugging
}

// RepositoryManager provides access to all repositories
type RepositoryManager struct {
	Users UserRepository
	OTPs  OTPRepository
}
