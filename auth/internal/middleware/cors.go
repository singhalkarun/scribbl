package middleware

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/rs/cors"
)

// Logger interface for dependency injection
type Logger interface {
	Fatal(v ...interface{})
	Println(v ...interface{})
}

// StandardLogger wraps the standard log package
type StandardLogger struct{}

func (l StandardLogger) Fatal(v ...interface{}) {
	log.Fatal(v...)
}

func (l StandardLogger) Println(v ...interface{}) {
	log.Println(v...)
}

// CorsMiddleware creates a CORS middleware using rs/cors library
// but maintains the same environment variable configuration as before
func CorsMiddleware(next http.Handler) http.Handler {
	return CorsMiddlewareWithLogger(next, StandardLogger{})
}

// CorsMiddlewareWithLogger creates a CORS middleware with a custom logger (for testing)
func CorsMiddlewareWithLogger(next http.Handler, logger Logger) http.Handler {
	// Get allowed origins from environment variable (same as scribbl_backend)
	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		// Check if we're in production environment
		appEnv := os.Getenv("APP_ENV")
		if appEnv == "production" {
			// In production, we require explicit CORS configuration
			logger.Fatal("CORS_ALLOWED_ORIGINS must be set in production environment")
		}

		// Default to localhost for development only
		logger.Println("Warning: CORS_ALLOWED_ORIGINS not set, defaulting to localhost (development mode)")
		allowedOrigins = "http://localhost:3000,http://localhost:3001"
	}

	// Parse the allowed origins
	origins := strings.Split(allowedOrigins, ",")
	for i, origin := range origins {
		origins[i] = strings.TrimSpace(origin)
	}

	// Create CORS middleware with rs/cors
	c := cors.New(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	return c.Handler(next)
}
