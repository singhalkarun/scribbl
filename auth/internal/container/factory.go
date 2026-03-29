package container

import (
	"fmt"
	"os"
	"strings"

	"auth/internal/storage"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// ContainerType represents the type of container to create
type ContainerType string

const (
	Production ContainerType = "production"
	Test       ContainerType = "test"
	AutoDetect ContainerType = "auto"
)

// Factory provides methods to create different types of containers
type Factory struct{}

// NewFactory creates a new container factory
func NewFactory() *Factory {
	return &Factory{}
}

// CreateContainer creates a container based on the specified type
func (f *Factory) CreateContainer(containerType ContainerType) (ContainerInterface, error) {
	switch containerType {
	case Production:
		return f.CreateProductionContainer()
	case Test:
		return f.CreateTestContainer(), nil
	case AutoDetect:
		return f.CreateAutoDetectedContainer()
	default:
		return nil, fmt.Errorf("unsupported container type: %s", containerType)
	}
}

// CreateProductionContainer creates a production container with database connections
func (f *Factory) CreateProductionContainer() (*ProductionContainer, error) {
	// Initialize storage connections using the storage package
	// This handles connection pooling, table creation, and configuration
	storage.InitPostgres()
	storage.InitRedis()

	// Use the initialized storage connections
	return NewProductionContainerFromStorage()
}

// CreateTestContainer creates a test container with mock repositories
func (f *Factory) CreateTestContainer() *TestContainer {
	return NewTestContainer()
}

// CreateRedisTestContainer creates a test container with real Redis
func (f *Factory) CreateRedisTestContainer() (*RedisTestContainer, error) {
	return NewRedisTestContainer()
}

// CreateAutoDetectedContainer creates a container based on environment detection
func (f *Factory) CreateAutoDetectedContainer() (ContainerInterface, error) {
	// Check if we're in a test environment
	if f.isTestEnvironment() {
		// Try to use Redis for integration tests if available
		if IsRedisAvailable() {
			container, err := f.CreateRedisTestContainer()
			if err == nil {
				return container, nil
			}
			// Fall back to mock if Redis setup fails
		}
		// Use mock container as fallback
		return f.CreateTestContainer(), nil
	}

	// Otherwise, create production container
	return f.CreateProductionContainer()
}

// isTestEnvironment detects if we're running in a test environment
func (f *Factory) isTestEnvironment() bool {
	// Check if running under go test
	for _, arg := range os.Args {
		if strings.Contains(arg, "test") || strings.HasSuffix(arg, ".test") {
			return true
		}
	}

	// Check environment variables
	if os.Getenv("GO_ENV") == "test" || os.Getenv("ENVIRONMENT") == "test" {
		return true
	}

	// Check if test-specific environment variables are set
	if os.Getenv("TEST_MODE") == "true" {
		return true
	}

	return false
}

// Note: Database and Redis connection creation is now handled by the storage package
// This eliminates code duplication and ensures consistent configuration

// Global factory instance for convenience
var defaultFactory = NewFactory()

// CreateContainer creates a container using the default factory
func CreateContainer(containerType ContainerType) (ContainerInterface, error) {
	return defaultFactory.CreateContainer(containerType)
}

// CreateProductionContainer creates a production container using the default factory
func CreateProductionContainer() (*ProductionContainer, error) {
	return defaultFactory.CreateProductionContainer()
}

// CreateTestContainer creates a test container using the default factory
func CreateTestContainer() *TestContainer {
	return defaultFactory.CreateTestContainer()
}

// CreateRedisTestContainer creates a test container with real Redis using the default factory
func CreateRedisTestContainer() (*RedisTestContainer, error) {
	return defaultFactory.CreateRedisTestContainer()
}

// CreateAutoDetectedContainer creates a container with auto-detection using the default factory
func CreateAutoDetectedContainer() (ContainerInterface, error) {
	return defaultFactory.CreateAutoDetectedContainer()
}
