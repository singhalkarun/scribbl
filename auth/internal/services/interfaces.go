package services

import (
	"auth/internal/repositories"
)

// AuthService handles authentication business logic
type AuthService interface {
	RequestOTP(phone string) error
	VerifyOTP(phone, otp string) (*repositories.User, string, error) // user, jwt, error
}

// UserService handles user management business logic
type UserService interface {
	GetUserProfile(phone string) (*repositories.User, error)
	UpdateUserProfile(phone, name string) (*repositories.User, error)
}

// ServiceManager provides access to all services
type ServiceManager struct {
	Auth  AuthService
	User  UserService
	Repos *repositories.RepositoryManager
}
