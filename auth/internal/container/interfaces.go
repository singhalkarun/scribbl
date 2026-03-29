package container

import (
	"auth/internal/services"
)

// Container manages all application dependencies
type Container struct {
	Services *services.ServiceManager
}

// ContainerInterface defines the contract for dependency containers
type ContainerInterface interface {
	GetServices() *services.ServiceManager
	Shutdown() error // For cleanup during shutdown
}

// Implement the interface for Container
func (c *Container) GetServices() *services.ServiceManager {
	return c.Services
}

func (c *Container) Shutdown() error {
	// Placeholder for cleanup logic (database connections, etc.)
	return nil
}
