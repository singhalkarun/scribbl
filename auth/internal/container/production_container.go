package container

import (
	"database/sql"
	"fmt"

	"auth/internal/repositories"
	"auth/internal/services"
	"auth/internal/storage"

	"github.com/redis/go-redis/v9"
)

// ProductionContainer implements ContainerInterface for production environment
type ProductionContainer struct {
	*Container
	db          *sql.DB
	redisClient *redis.Client
}

// NewProductionContainer creates a container with real database connections
func NewProductionContainer(db *sql.DB, redisClient *redis.Client) (*ProductionContainer, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection is required for production container")
	}

	if redisClient == nil {
		return nil, fmt.Errorf("redis connection is required for production container")
	}

	// Create repositories with real database connections
	userRepo := repositories.NewPostgresUserRepository(db)
	otpRepo := repositories.NewRedisOTPRepository(redisClient)

	// Create repository manager
	repoManager := &repositories.RepositoryManager{
		Users: userRepo,
		OTPs:  otpRepo,
	}

	// Create services with repository dependencies
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

	return &ProductionContainer{
		Container:   container,
		db:          db,
		redisClient: redisClient,
	}, nil
}

// NewProductionContainerFromStorage creates a container using existing storage connections
func NewProductionContainerFromStorage() (*ProductionContainer, error) {
	// Use global storage connections
	if storage.DB == nil {
		return nil, fmt.Errorf("database connection not initialized - call storage.InitPostgres() first")
	}

	if storage.RedisClient == nil {
		return nil, fmt.Errorf("redis connection not initialized - call storage.InitRedis() first")
	}

	return NewProductionContainer(storage.DB, storage.RedisClient)
}

// Shutdown closes database connections and cleans up resources
func (c *ProductionContainer) Shutdown() error {
	var errors []error

	// Close Redis connection
	if c.redisClient != nil {
		if err := c.redisClient.Close(); err != nil {
			errors = append(errors, fmt.Errorf("failed to close Redis connection: %w", err))
		}
	}

	// Close database connection
	if c.db != nil {
		if err := c.db.Close(); err != nil {
			errors = append(errors, fmt.Errorf("failed to close database connection: %w", err))
		}
	}

	// Return combined errors if any
	if len(errors) > 0 {
		errMsg := "shutdown errors: "
		for i, err := range errors {
			if i > 0 {
				errMsg += "; "
			}
			errMsg += err.Error()
		}
		return fmt.Errorf(errMsg)
	}

	return nil
}

// GetDatabase returns the database connection (useful for migrations, health checks, etc.)
func (c *ProductionContainer) GetDatabase() *sql.DB {
	return c.db
}

// GetRedisClient returns the Redis client (useful for health checks, direct operations, etc.)
func (c *ProductionContainer) GetRedisClient() *redis.Client {
	return c.redisClient
}

// HealthCheck verifies that all dependencies are healthy
func (c *ProductionContainer) HealthCheck() error {
	// Check database connection
	if err := c.db.Ping(); err != nil {
		return fmt.Errorf("database health check failed: %w", err)
	}

	// Check Redis connection
	if err := c.redisClient.Ping(storage.GetContext()).Err(); err != nil {
		return fmt.Errorf("redis health check failed: %w", err)
	}

	return nil
}
