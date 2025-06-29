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
	"auth/internal/handlers"
	"auth/internal/middleware"
	"auth/internal/storage"

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
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize Redis connection
	storage.InitRedis()

	// Initialize PostgreSQL connection
	storage.InitPostgres()

	// Validate required environment variables (using same names as scribbl_backend)
	requiredEnvVars := []string{"SECRET_KEY_BASE", "TWO_FACTOR_API_KEY", "OTP_TEMPLATE_NAME"}
	for _, envVar := range requiredEnvVars {
		if os.Getenv(envVar) == "" {
			log.Fatalf("Required environment variable %s not set", envVar)
		}
	}

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = config.DefaultPort
	}

	// Setup HTTP routes
	mux := http.NewServeMux()
	mux.Handle("/auth/request-otp", middleware.CorsMiddleware(middleware.RateLimitMiddleware(http.HandlerFunc(handlers.RequestOTPHandler))))
	mux.Handle("/auth/verify-otp", middleware.CorsMiddleware(http.HandlerFunc(handlers.VerifyOTPHandler)))

	// Protected user endpoints
	mux.Handle("/auth/user", middleware.CorsMiddleware(middleware.AuthMiddleware(methodHandler("GET", handlers.GetUserHandler))))
	mux.Handle("/auth/user/update", middleware.CorsMiddleware(middleware.AuthMiddleware(methodHandler("PUT", handlers.UpdateUserHandler))))

	// Add health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"auth"}`))
	})

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
		log.Printf("Auth service starting on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
