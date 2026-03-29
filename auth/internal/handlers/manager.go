package handlers

import (
	"auth/internal/container"
	"auth/internal/middleware"
	"auth/internal/services"
	"encoding/json"
	"net/http"
)

// Handlers combines all handlers
type Handlers struct {
	Auth *AuthHandlers
	User *UserHandlers
}

// NewHandlers creates all handlers from a service manager
func NewHandlers(serviceManager *services.ServiceManager) *Handlers {
	return &Handlers{
		Auth: NewAuthHandlers(serviceManager.Auth, serviceManager.User),
		User: NewUserHandlers(serviceManager.User),
	}
}

// NewHandlersFromContainer creates all handlers from a container
func NewHandlersFromContainer(c container.ContainerInterface) *Handlers {
	return NewHandlers(c.GetServices())
}

// HandlerManager provides access to all handlers
type HandlerManager struct {
	handlers *Handlers
}

// NewHandlerManager creates a handler manager
func NewHandlerManager(c container.ContainerInterface) *HandlerManager {
	return &HandlerManager{
		handlers: NewHandlersFromContainer(c),
	}
}

// GetAuthHandlers returns auth handlers
func (hm *HandlerManager) GetAuthHandlers() *AuthHandlers {
	return hm.handlers.Auth
}

// GetUserHandlers returns user handlers
func (hm *HandlerManager) GetUserHandlers() *UserHandlers {
	return hm.handlers.User
}

// HealthChecker interface for containers that support health checks
type HealthChecker interface {
	HealthCheck() error
}

// NewHealthCheckHandler creates a health check handler that uses the container
func NewHealthCheckHandler(c container.ContainerInterface) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"status": "healthy",
			"services": map[string]string{
				"auth": "up",
				"user": "up",
			},
		}

		// Check container health if it supports health checks
		if healthChecker, ok := c.(HealthChecker); ok {
			if err := healthChecker.HealthCheck(); err != nil {
				response = map[string]interface{}{
					"status": "unhealthy",
					"error":  err.Error(),
				}
				w.WriteHeader(500)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// methodHandler wraps a handler to only accept specific HTTP methods
func methodHandler(method string, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header().Set("Allow", method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}
}

// SetupRoutes helper that sets up all routes with proper middleware
func SetupRoutes(mux *http.ServeMux, c container.ContainerInterface) {
	handlers := NewHandlersFromContainer(c)

	// Public auth endpoints (with CORS and rate limiting middleware)
	mux.Handle("/auth/request-otp",
		middleware.CorsMiddleware(
			middleware.RateLimitMiddleware(
				handlers.Auth.RequestOTPHandlerFunc())))

	mux.Handle("/auth/verify-otp",
		middleware.CorsMiddleware(
			handlers.Auth.VerifyOTPHandlerFunc()))

	// Protected user endpoints (with CORS and auth middleware)
	mux.Handle("/auth/user",
		middleware.CorsMiddleware(
			middleware.AuthMiddleware(
				methodHandler("GET", handlers.User.GetUserHandlerFunc()))))

	mux.Handle("/auth/user/update",
		middleware.CorsMiddleware(
			middleware.AuthMiddleware(
				methodHandler("PUT", handlers.User.UpdateUserHandlerFunc()))))

	// Health check route
	mux.HandleFunc("/health", NewHealthCheckHandler(c))
}
