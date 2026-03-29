package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auth/internal/config"
	"auth/internal/container"
	"auth/internal/handlers"
	"auth/internal/middleware"

	"github.com/joho/godotenv"
)

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

func main() {
	log.Println("🚀 Starting Auth Service with Container Architecture...")

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Validate required environment variables
	requiredEnvVars := []string{"SECRET_KEY_BASE", "TWO_FACTOR_API_KEY", "OTP_TEMPLATE_NAME"}
	for _, envVar := range requiredEnvVars {
		if os.Getenv(envVar) == "" {
			log.Fatalf("❌ Required environment variable %s not set", envVar)
		}
	}

	// Create container with auto-detection (production vs test)
	appContainer, err := container.CreateAutoDetectedContainer()
	if err != nil {
		log.Fatalf("❌ Failed to create application container: %v", err)
	}
	defer func() {
		log.Println("🧹 Shutting down container...")
		if err := appContainer.Shutdown(); err != nil {
			log.Printf("⚠️ Error during container shutdown: %v", err)
		}
	}()

	log.Println("✅ Container initialized successfully")

	// Create handlers from container
	appHandlers := handlers.NewHandlersFromContainer(appContainer)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = config.DefaultPort
	}

	// Setup HTTP routes with handlers
	mux := http.NewServeMux()

	// Public auth endpoints (with middleware)
	mux.Handle("/auth/request-otp",
		middleware.CorsMiddleware(
			middleware.RateLimitMiddleware(
				appHandlers.Auth.RequestOTPHandlerFunc())))

	mux.Handle("/auth/verify-otp",
		middleware.CorsMiddleware(
			appHandlers.Auth.VerifyOTPHandlerFunc()))

	// Protected user endpoints (with auth middleware)
	mux.Handle("/auth/user",
		middleware.CorsMiddleware(
			middleware.AuthMiddleware(
				methodHandler("GET", appHandlers.User.GetUserHandlerFunc()))))

	mux.Handle("/auth/user/update",
		middleware.CorsMiddleware(
			middleware.AuthMiddleware(
				methodHandler("PUT", appHandlers.User.UpdateUserHandlerFunc()))))

	// Enhanced health check endpoint using container
	mux.HandleFunc("/health", handlers.NewHealthCheckHandler(appContainer))

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("🌐 Auth service starting on port %s", port)
		log.Printf("📍 Available endpoints:")
		log.Printf("   POST /auth/request-otp    - Request OTP for phone number")
		log.Printf("   POST /auth/verify-otp     - Verify OTP and authenticate")
		log.Printf("   GET  /auth/user           - Get user profile (requires auth)")
		log.Printf("   PUT  /auth/user/update    - Update user profile (requires auth)")
		log.Printf("   GET  /health              - Service health check")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down server...")

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("⚠️ Server forced to shutdown: %v", err)
	} else {
		log.Println("✅ Server shut down gracefully")
	}

	log.Println("✅ Application exited cleanly")
}
