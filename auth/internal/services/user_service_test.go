package services

import (
	"testing"

	"auth/internal/repositories"
)

func TestUserService(t *testing.T) {
	t.Run("constructor", func(t *testing.T) {
		userRepo := repositories.NewMockUserRepository()
		userService := NewUserService(userRepo)

		if userService == nil {
			t.Error("NewUserService should not return nil")
		}

		// Verify it's the correct type
		if _, ok := userService.(*UserServiceImpl); !ok {
			t.Error("NewUserService should return *UserServiceImpl")
		}
	})
}

func TestUserService_GetUserProfile(t *testing.T) {
	userRepo := repositories.NewMockUserRepository()
	userService := NewUserService(userRepo)

	t.Run("existing user", func(t *testing.T) {
		userRepo.Clear()
		phone := "+919876543210"

		// Create user first
		createdUser, err := userRepo.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		// Get user profile
		user, err := userService.GetUserProfile(phone)
		if err != nil {
			t.Fatalf("Failed to get user profile: %v", err)
		}

		if user == nil {
			t.Error("Expected user to be returned")
		}

		if user.ID != createdUser.ID {
			t.Errorf("Expected user ID %d, got %d", createdUser.ID, user.ID)
		}

		if user.Phone != phone {
			t.Errorf("Expected phone %s, got %s", phone, user.Phone)
		}
	})

	t.Run("non-existent user", func(t *testing.T) {
		userRepo.Clear()
		phone := "+919876543210"

		// Try to get profile for non-existent user
		user, err := userService.GetUserProfile(phone)
		if err == nil {
			t.Error("Expected error for non-existent user")
		}

		if user != nil {
			t.Error("Expected no user for non-existent user")
		}
	})

	t.Run("invalid phone format", func(t *testing.T) {
		invalidPhone := "invalid-phone"

		user, err := userService.GetUserProfile(invalidPhone)
		if err == nil {
			t.Error("Expected error for invalid phone format")
		}

		if user != nil {
			t.Error("Expected no user for invalid phone")
		}
	})
}

func TestUserService_UpdateUserProfile(t *testing.T) {
	userRepo := repositories.NewMockUserRepository()
	userService := NewUserService(userRepo)

	t.Run("valid name update", func(t *testing.T) {
		userRepo.Clear()
		phone := "+919876543210"
		newName := "John Doe"

		// Create user first
		_, err := userRepo.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		// Update user profile
		user, err := userService.UpdateUserProfile(phone, newName)
		if err != nil {
			t.Fatalf("Failed to update user profile: %v", err)
		}

		if user == nil {
			t.Error("Expected user to be returned")
		}

		if user.Name == nil || *user.Name != newName {
			actualName := ""
			if user.Name != nil {
				actualName = *user.Name
			}
			t.Errorf("Expected name %s, got %s", newName, actualName)
		}

		if user.Phone != phone {
			t.Errorf("Expected phone %s, got %s", phone, user.Phone)
		}
	})

	t.Run("name sanitization", func(t *testing.T) {
		userRepo.Clear()
		phone := "+919876543210"
		dirtyName := "  John   Doe  "
		expectedName := "John Doe"

		// Create user first
		_, err := userRepo.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		// Update with dirty name
		user, err := userService.UpdateUserProfile(phone, dirtyName)
		if err != nil {
			t.Fatalf("Failed to update user profile: %v", err)
		}

		if user.Name == nil || *user.Name != expectedName {
			actualName := ""
			if user.Name != nil {
				actualName = *user.Name
			}
			t.Errorf("Expected sanitized name %s, got %s", expectedName, actualName)
		}
	})

	t.Run("invalid name", func(t *testing.T) {
		userRepo.Clear()
		phone := "+919876543210"
		invalidName := "" // Empty name after sanitization

		// Create user first
		_, err := userRepo.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		// Try to update with invalid name
		user, err := userService.UpdateUserProfile(phone, invalidName)
		if err == nil {
			t.Error("Expected error for invalid name")
		}

		if user != nil {
			t.Error("Expected no user for invalid name update")
		}
	})

	t.Run("non-existent user", func(t *testing.T) {
		userRepo.Clear()
		phone := "+919876543210"
		name := "John Doe"

		// Try to update non-existent user
		user, err := userService.UpdateUserProfile(phone, name)
		if err == nil {
			t.Error("Expected error for non-existent user")
		}

		if user != nil {
			t.Error("Expected no user for non-existent user update")
		}
	})
}
