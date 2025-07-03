package container

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"auth/internal/repositories"
	"auth/internal/services"

	_ "github.com/lib/pq" // PostgreSQL driver
	"github.com/redis/go-redis/v9"
)

// RedisTestContainer implements ContainerInterface for integration testing with real Redis
type RedisTestContainer struct {
	*Container
	redisClient *redis.Client
	db          *sql.DB
	userRepo    repositories.UserRepository
	otpRepo     repositories.OTPRepository
}

// NewRedisTestContainer creates a container with real Redis and mock PostgreSQL for integration testing
func NewRedisTestContainer() (*RedisTestContainer, error) {
	// Set up Redis connection
	redisAddr := os.Getenv("TEST_REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
		DB:   15, // Use DB 15 for testing
	})

	// Test Redis connection
	ctx := context.Background()
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Redis at %s: %w", redisAddr, err)
	}

	// Clear test database
	err = redisClient.FlushDB(ctx).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to flush Redis test database: %w", err)
	}

	// For now, use mock user repository for faster testing
	// In the future, this could be changed to use a real test database
	userRepo := repositories.NewMockUserRepository()

	// Use real Redis OTP repository
	otpRepo := repositories.NewRedisOTPRepository(redisClient)

	// Create repository manager
	repoManager := &repositories.RepositoryManager{
		Users: userRepo,
		OTPs:  otpRepo,
	}

	// Create services with real Redis dependency
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

	return &RedisTestContainer{
		Container:   container,
		redisClient: redisClient,
		userRepo:    userRepo,
		otpRepo:     otpRepo,
	}, nil
}

// GetRedisClient returns the Redis client for testing
func (c *RedisTestContainer) GetRedisClient() *redis.Client {
	return c.redisClient
}

// GetUserRepository returns the user repository
func (c *RedisTestContainer) GetUserRepository() repositories.UserRepository {
	return c.userRepo
}

// GetOTPRepository returns the OTP repository
func (c *RedisTestContainer) GetOTPRepository() repositories.OTPRepository {
	return c.otpRepo
}

// GetMockUserRepository returns the mock user repository for test manipulation
func (c *RedisTestContainer) GetMockUserRepository() *repositories.MockUserRepository {
	return c.userRepo.(*repositories.MockUserRepository)
}

// ClearAllData clears all test data from Redis and mock repositories
func (c *RedisTestContainer) ClearAllData() {
	// Clear Redis data
	ctx := context.Background()
	c.redisClient.FlushDB(ctx)

	// Clear mock user data
	c.GetMockUserRepository().Clear()
}

// Shutdown closes Redis connection and cleans up resources
func (c *RedisTestContainer) Shutdown() error {
	// Clear test data
	c.ClearAllData()

	// Close Redis connection
	if c.redisClient != nil {
		return c.redisClient.Close()
	}

	return nil
}

// Reset resets the container to initial state
func (c *RedisTestContainer) Reset() {
	c.ClearAllData()
}

// SeedTestData populates the container with test data
func (c *RedisTestContainer) SeedTestData() error {
	userRepo := c.GetMockUserRepository()

	// Clear existing data first
	c.ClearAllData()

	// Create test users
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
func (c *RedisTestContainer) GetTestPhoneNumber() string {
	return "+19999999999"
}

// GetTestOTP returns the fixed OTP for the test phone number
func (c *RedisTestContainer) GetTestOTP() string {
	return "7415"
}

// CreateTestUser creates a user for testing and returns it
func (c *RedisTestContainer) CreateTestUser(phone string) (*repositories.User, error) {
	userRepo := c.GetMockUserRepository()
	user, err := userRepo.CreateUserIfNotExists(phone)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// HealthCheck verifies that Redis connection is healthy
func (c *RedisTestContainer) HealthCheck() error {
	ctx := context.Background()
	_, err := c.redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("Redis health check failed: %w", err)
	}
	return nil
}

// IsRedisAvailable checks if Redis is available for testing
func IsRedisAvailable() bool {
	redisAddr := os.Getenv("TEST_REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr: redisAddr,
		DB:   15,
	})
	defer client.Close()

	ctx := context.Background()
	_, err := client.Ping(ctx).Result()
	return err == nil
}
