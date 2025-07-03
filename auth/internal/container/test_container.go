package container

import (
	"auth/internal/repositories"
	"auth/internal/services"
)

// TestContainer implements ContainerInterface for testing environment
type TestContainer struct {
	*Container
	userRepo repositories.UserRepository
	otpRepo  repositories.OTPRepository
}

// NewTestContainer creates a container with mock repositories for testing
func NewTestContainer() *TestContainer {
	// Create mock repositories
	userRepo := repositories.NewMockUserRepository()
	otpRepo := repositories.NewMockOTPRepository()

	// Create repository manager
	repoManager := &repositories.RepositoryManager{
		Users: userRepo,
		OTPs:  otpRepo,
	}

	// Create services with mock repository dependencies
	authService := services.NewAuthService(userRepo, otpRepo)
	userService := services.NewUserService(userRepo)

	// Create service manager
	serviceManager := &services.ServiceManager{
		Auth:  authService,
		User:  userService,
		Repos: repoManager,
	}

	// Create container
	container := &Container{
		Services: serviceManager,
	}

	return &TestContainer{
		Container: container,
		userRepo:  userRepo,
		otpRepo:   otpRepo,
	}
}

// GetUserRepository returns the mock user repository for test manipulation
func (c *TestContainer) GetUserRepository() repositories.UserRepository {
	return c.userRepo
}

// GetOTPRepository returns the mock OTP repository for test manipulation
func (c *TestContainer) GetOTPRepository() repositories.OTPRepository {
	return c.otpRepo
}

// GetMockUserRepository returns the mock user repository with testing methods
func (c *TestContainer) GetMockUserRepository() *repositories.MockUserRepository {
	return c.userRepo.(*repositories.MockUserRepository)
}

// GetMockOTPRepository returns the mock OTP repository with testing methods
func (c *TestContainer) GetMockOTPRepository() *repositories.MockOTPRepository {
	return c.otpRepo.(*repositories.MockOTPRepository)
}

// ClearAllData clears all mock data - useful for test cleanup
func (c *TestContainer) ClearAllData() {
	c.GetMockUserRepository().Clear()
	c.GetMockOTPRepository().Clear()
}

// Shutdown for test container is a no-op since there are no resources to clean up
func (c *TestContainer) Shutdown() error {
	// Clear data for clean shutdown
	c.ClearAllData()
	return nil
}

// Reset resets the container to initial state (useful for test isolation)
func (c *TestContainer) Reset() {
	c.ClearAllData()
}

// SeedTestData populates the container with common test data
func (c *TestContainer) SeedTestData() error {
	userRepo := c.GetMockUserRepository()
	otpRepo := c.GetMockOTPRepository()

	// Clear existing data first
	userRepo.Clear()
	otpRepo.Clear()

	// Create some test users
	testUsers := []string{
		"+19999999999", // Test phone number that doesn't send SMS
		"+911234567890",
		"+919876543210",
	}

	for _, phone := range testUsers {
		_, err := userRepo.CreateUserIfNotExists(phone)
		if err != nil {
			return err
		}
	}

	return nil
}

// GetTestPhoneNumber returns the standard test phone number
func (c *TestContainer) GetTestPhoneNumber() string {
	return "+19999999999"
}

// GetTestOTP returns the fixed OTP for the test phone number
func (c *TestContainer) GetTestOTP() string {
	return "7415"
}

// CreateTestUser creates a user for testing and returns it
func (c *TestContainer) CreateTestUser(phone string) (*repositories.User, error) {
	userRepo := c.GetMockUserRepository()
	user, err := userRepo.CreateUserIfNotExists(phone)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// HealthCheck for test container always returns nil (always healthy)
func (c *TestContainer) HealthCheck() error {
	return nil
}
