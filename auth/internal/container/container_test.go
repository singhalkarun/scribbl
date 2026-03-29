package container

import (
	"os"
	"testing"
)

func TestTestContainerImplementation(t *testing.T) {
	t.Run("creation and basic functionality", func(t *testing.T) {
		container := NewTestContainer()

		if container == nil {
			t.Error("NewTestContainer should not return nil")
		}

		// Verify services are available
		services := container.GetServices()
		if services == nil {
			t.Error("Expected services to be available")
		}

		if services.Auth == nil {
			t.Error("Expected Auth service to be available")
		}

		if services.User == nil {
			t.Error("Expected User service to be available")
		}

		if services.Repos == nil {
			t.Error("Expected repository manager to be available")
		}
	})

	t.Run("repository access", func(t *testing.T) {
		container := NewTestContainer()

		userRepo := container.GetUserRepository()
		if userRepo == nil {
			t.Error("Expected user repository to be available")
		}

		otpRepo := container.GetOTPRepository()
		if otpRepo == nil {
			t.Error("Expected OTP repository to be available")
		}

		// Test mock repository access
		mockUserRepo := container.GetMockUserRepository()
		if mockUserRepo == nil {
			t.Error("Expected mock user repository to be available")
		}

		mockOTPRepo := container.GetMockOTPRepository()
		if mockOTPRepo == nil {
			t.Error("Expected mock OTP repository to be available")
		}
	})

	t.Run("data management", func(t *testing.T) {
		container := NewTestContainer()

		// Add some test data
		userRepo := container.GetMockUserRepository()
		_, err := userRepo.CreateUserIfNotExists("+919876543210")
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		if userRepo.Count() != 1 {
			t.Errorf("Expected 1 user, got %d", userRepo.Count())
		}

		// Clear all data
		container.ClearAllData()

		if userRepo.Count() != 0 {
			t.Errorf("Expected 0 users after clear, got %d", userRepo.Count())
		}
	})

	t.Run("seed test data", func(t *testing.T) {
		container := NewTestContainer()

		err := container.SeedTestData()
		if err != nil {
			t.Fatalf("Failed to seed test data: %v", err)
		}

		userRepo := container.GetMockUserRepository()
		if userRepo.Count() != 3 {
			t.Errorf("Expected 3 users after seeding, got %d", userRepo.Count())
		}

		// Verify test phone number exists
		testPhone := container.GetTestPhoneNumber()
		_, err = userRepo.GetUserByPhone(testPhone)
		if err != nil {
			t.Errorf("Expected test phone number %s to exist after seeding", testPhone)
		}
	})

	t.Run("test helpers", func(t *testing.T) {
		container := NewTestContainer()

		// Test phone number
		testPhone := container.GetTestPhoneNumber()
		if testPhone != "+19999999999" {
			t.Errorf("Expected test phone number +19999999999, got %s", testPhone)
		}

		// Test OTP
		testOTP := container.GetTestOTP()
		if testOTP != "7415" {
			t.Errorf("Expected test OTP 7415, got %s", testOTP)
		}
	})

	t.Run("create test user", func(t *testing.T) {
		container := NewTestContainer()

		phone := "+911234567890"
		user, err := container.CreateTestUser(phone)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		if user == nil {
			t.Error("Expected user to be returned")
		}

		if user.Phone != phone {
			t.Errorf("Expected phone %s, got %s", phone, user.Phone)
		}
	})

	t.Run("shutdown", func(t *testing.T) {
		container := NewTestContainer()

		// Add data
		err := container.SeedTestData()
		if err != nil {
			t.Fatalf("Failed to seed test data: %v", err)
		}

		// Shutdown should clear data
		err = container.Shutdown()
		if err != nil {
			t.Errorf("Expected no error from shutdown, got: %v", err)
		}

		userRepo := container.GetMockUserRepository()
		if userRepo.Count() != 0 {
			t.Errorf("Expected 0 users after shutdown, got %d", userRepo.Count())
		}
	})
}

func TestFactory(t *testing.T) {
	t.Run("test container creation", func(t *testing.T) {
		factory := NewFactory()

		container := factory.CreateTestContainer()
		if container == nil {
			t.Error("CreateTestContainer should not return nil")
		}

		// Verify it's a test container
		services := container.GetServices()
		if services == nil {
			t.Error("Expected services to be available")
		}
	})

	t.Run("environment detection", func(t *testing.T) {
		factory := NewFactory()

		// Set test environment variable
		os.Setenv("TEST_MODE", "true")
		defer os.Unsetenv("TEST_MODE")

		isTest := factory.isTestEnvironment()
		if !isTest {
			t.Error("Expected test environment to be detected")
		}
	})
}

func TestContainerIntegration(t *testing.T) {
	t.Run("service integration", func(t *testing.T) {
		container := NewTestContainer()

		// Test auth service integration
		authService := container.GetServices().Auth
		phone := container.GetTestPhoneNumber()

		err := authService.RequestOTP(phone)
		if err != nil {
			t.Fatalf("Failed to request OTP: %v", err)
		}

		// Verify OTP was stored
		otpRepo := container.GetMockOTPRepository()
		if otpRepo.Count() != 1 {
			t.Errorf("Expected 1 OTP to be stored, got %d", otpRepo.Count())
		}

		// Test user service integration
		userService := container.GetServices().User
		user, err := userService.GetUserProfile(phone)
		if err == nil {
			t.Error("Expected error for non-existent user")
		}

		// Create user first
		_, err = container.CreateTestUser(phone)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}

		// Now get user profile should work
		user, err = userService.GetUserProfile(phone)
		if err != nil {
			t.Fatalf("Failed to get user profile: %v", err)
		}

		if user.Phone != phone {
			t.Errorf("Expected phone %s, got %s", phone, user.Phone)
		}
	})
}
