package services

import (
	"database/sql"
	"fmt"
	"strings"

	"auth/internal/repositories"
	"auth/internal/utils"
)

// UserServiceImpl implements UserService interface
type UserServiceImpl struct {
	userRepo repositories.UserRepository
}

// NewUserService creates a new user service
func NewUserService(userRepo repositories.UserRepository) UserService {
	return &UserServiceImpl{
		userRepo: userRepo,
	}
}

// GetUserProfile retrieves a user's profile by phone number
func (s *UserServiceImpl) GetUserProfile(phone string) (*repositories.User, error) {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return nil, fmt.Errorf("invalid phone format: %w", err)
	}

	// Get user from repository
	user, err := s.userRepo.GetUserByPhone(phone)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}

	return user, nil
}

// UpdateUserProfile updates a user's profile information
func (s *UserServiceImpl) UpdateUserProfile(phone, name string) (*repositories.User, error) {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return nil, fmt.Errorf("invalid phone format: %w", err)
	}

	// Validate and sanitize name
	sanitizedName, err := s.validateAndSanitizeName(name)
	if err != nil {
		return nil, fmt.Errorf("name validation failed: %w", err)
	}

	// Update user in repository
	user, err := s.userRepo.UpdateUserName(phone, sanitizedName)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to update user profile: %w", err)
	}

	return user, nil
}

// validateAndSanitizeName validates and sanitizes the user name
func (s *UserServiceImpl) validateAndSanitizeName(name string) (string, error) {
	// Basic validation
	if strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("name is required")
	}

	// Length validation
	if len(name) > 100 {
		return "", fmt.Errorf("name cannot exceed 100 characters")
	}

	// Validate name using existing utils function
	if err := utils.ValidateName(name); err != nil {
		return "", err
	}

	// Sanitize: trim whitespace and normalize internal spaces
	sanitized := utils.SanitizeName(name)

	return sanitized, nil
}

// Additional helper methods for extended functionality

// CreateUser creates a new user (useful for admin operations)
func (s *UserServiceImpl) CreateUser(phone string) (*repositories.User, error) {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return nil, fmt.Errorf("invalid phone format: %w", err)
	}

	// Create user
	user, err := s.userRepo.CreateUserIfNotExists(phone)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// DeleteUser deletes a user by phone number (useful for admin operations)
func (s *UserServiceImpl) DeleteUser(phone string) error {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return fmt.Errorf("invalid phone format: %w", err)
	}

	// Delete user from repository
	err := s.userRepo.DeleteUser(phone)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// UserExists checks if a user exists by phone number
func (s *UserServiceImpl) UserExists(phone string) (bool, error) {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return false, fmt.Errorf("invalid phone format: %w", err)
	}

	// Try to get user
	_, err := s.userRepo.GetUserByPhone(phone)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil // User doesn't exist, but no error
		}
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}

	return true, nil
}

// UpdateUserProfilePartial allows partial updates to user profile
func (s *UserServiceImpl) UpdateUserProfilePartial(phone string, updates map[string]interface{}) (*repositories.User, error) {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return nil, fmt.Errorf("invalid phone format: %w", err)
	}

	// Get current user
	user, err := s.GetUserProfile(phone)
	if err != nil {
		return nil, err // Error already formatted
	}

	// Process updates
	if name, exists := updates["name"]; exists {
		if nameStr, ok := name.(string); ok {
			sanitizedName, err := s.validateAndSanitizeName(nameStr)
			if err != nil {
				return nil, fmt.Errorf("invalid name: %w", err)
			}

			// Update name
			user, err = s.userRepo.UpdateUserName(phone, sanitizedName)
			if err != nil {
				return nil, fmt.Errorf("failed to update user name: %w", err)
			}
		} else {
			return nil, fmt.Errorf("name must be a string")
		}
	}

	// Future: Add support for other profile fields here
	// if email, exists := updates["email"]; exists { ... }

	return user, nil
}
