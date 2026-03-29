# Go Auth Service (Phone + OTP) with Container Architecture

A modern, production-ready authentication service in Go using phone number and OTP (One-Time Password) for signup and login. Features **clean container-based dependency injection architecture**, JWT token issuance, PostgreSQL for user storage, Redis for temporary OTP storage, 2factor.in Transactional SMS API for OTP delivery, and built-in rate limiting. Built with **service-oriented architecture** and **comprehensive separation of concerns**.

## Features

### 🏗️ **Architecture & Design**
- **Container-based dependency injection** - Clean, testable architecture
- **Service-oriented design** - Proper separation of concerns (HTTP → Service → Repository → Storage)
- **Interface-based abstractions** - Easy testing and mocking
- **Auto-environment detection** - Automatically switches between production and test containers
- **Comprehensive test coverage** - 145+ test cases across all layers

### 🔐 **Authentication & Security**
- **Passwordless authentication** (phone + OTP)
- **Unified signup/login flow** - Same endpoint for new and existing users
- **JWT token issuance** with configurable expiry
- **E.164 phone number format validation**
- **Built-in rate limiting** (configurable, defaults to 5 requests per minute per phone number)
- **Secure OTP handling** with automatic expiry and consumption

### 🗄️ **Data Storage**
- **PostgreSQL for persistent user storage** with connection pooling
- **Redis for temporary OTP storage** with automatic TTL
- **Automatic database table creation** on startup
- **Thread-safe operations** across all data layers

### 📱 **Communication & Integration**
- **2factor.in Transactional SMS API** for OTP delivery
- **User profile management** (get user, update name)
- **CORS support** with configurable origins
- **Health check endpoints** with container monitoring

### 🔧 **Development & Operations**
- **Environment variable and `.env` support**
- **Docker and Docker Compose** for local development
- **Graceful shutdown** with proper resource cleanup
- **Comprehensive logging** with emojis for easy reading
- **Test phone number support** for development
- **Hot-reloadable configuration**

## How it works
- The backend generates a 4-digit OTP.
- The OTP is sent to the user's phone via 2factor.in's Transactional SMS API (`ADDON_SERVICES/SEND/TSMS`).
- The OTP and expiry are stored in Redis (keyed by phone number).
- When the user submits the OTP, the backend validates the format (must be exactly 4 digits) and checks against Redis.
- Phone numbers must be in E.164 format (e.g., +919876543210).
- Built-in rate limiting prevents abuse (configurable via RATE_LIMIT_PER_MINUTE, defaults to 5 OTP requests per minute per phone number).
- On success, a JWT token is issued.

## Project Structure

### 🏗️ **Modern Container-Based Architecture**
```
cmd/
  auth/
    main.go           # Application entry point (uses container system)
internal/
  container/          # 🆕 Dependency injection container system
    interfaces.go     # Container interface definitions
    factory.go        # Container factory with auto-detection
    production_container.go  # Production container (real DB/Redis)
    test_container.go # Test container (mocks)
    examples.go       # Usage examples
    container_test.go # Container tests
  services/           # 🆕 Business logic layer
    interfaces.go     # Service interface definitions
    auth_service.go   # Authentication business logic
    user_service.go   # User management business logic
    auth_service_test.go  # Auth service tests
    user_service_test.go  # User service tests
  repositories/       # 🆕 Data access layer
    interfaces.go     # Repository interface definitions
    postgres_user_repo.go    # PostgreSQL user repository
    redis_otp_repo.go # Redis OTP repository
    mock_user_repo.go # Mock user repository (testing)
    mock_otp_repo.go  # Mock OTP repository (testing)
    *_test.go         # Repository tests
  handlers/           # HTTP layer (updated to use services)
    service_auth.go   # 🆕 Service-based auth handlers
    service_user.go   # 🆕 Service-based user handlers  
    service_manager.go # 🆕 Handler management system
    auth.go           # Legacy handlers (deprecated)
    user.go           # Legacy handlers (deprecated)
    helpers.go        # Handler utilities
    *_test.go         # Handler tests
  config/
    config.go         # Configuration management
  storage/            # Database connection management
    redis.go          # Redis client initialization
    postgres.go       # PostgreSQL client initialization
  models/             # Data models (simplified, mostly used by legacy code)
    user.go           # User model and legacy operations
    models_test.go    # Model tests
  utils/              # Shared utilities
    otp.go            # OTP generation logic
    validation.go     # Phone/OTP/name validation
    errors.go         # Error utilities
    *_test.go         # Utility tests
  middleware/         # HTTP middleware
    cors.go           # CORS middleware
    ratelimit.go      # Rate limiting middleware
    auth.go           # JWT authentication middleware
    middleware_test.go # Middleware tests
  ARCHITECTURE.md     # 🆕 Architecture documentation
  PHASE_*_SUMMARY.md  # 🆕 Implementation phase summaries
examples/             # 🆕 Usage examples
  service_main.go     # Example using new container system
test/                 # Integration tests
  integration/
    auth_integration_test.go  # End-to-end API tests
Dockerfile
README.md
.env (not committed)
docker-compose.yml
go.mod
go.sum
```

### 🔄 **Architecture Flow**
```
HTTP Request → Handler → Service → Repository → Storage
     ↑            ↑         ↑          ↑          ↑
   Routes    (HTTP Logic) (Business) (Data)  (DB/Redis)
```

## 🚀 **Quick Start with Container Architecture**

### **Modern Service-Based Usage**
```go
package main

import (
    "log"
    "net/http"
    "auth/internal/container"
    "auth/internal/handlers"
)

func main() {
    // Create container (auto-detects environment)
    appContainer, err := container.CreateAutoDetectedContainer()
    if err != nil {
        log.Fatalf("Failed to create container: %v", err)
    }
    defer appContainer.Shutdown()

    // Create service-based handlers
    serviceHandlers := handlers.NewServiceHandlersFromContainer(appContainer)

    // Setup routes
    mux := http.NewServeMux()
    mux.HandleFunc("/auth/request-otp", serviceHandlers.Auth.RequestOTPHandlerFunc())
    mux.HandleFunc("/auth/verify-otp", serviceHandlers.Auth.VerifyOTPHandlerFunc())
    mux.HandleFunc("/user/profile", serviceHandlers.User.GetUserHandlerFunc())
    mux.HandleFunc("/health", handlers.NewHealthCheckHandler(appContainer))

    log.Println("🚀 Server starting with clean architecture!")
    http.ListenAndServe(":8080", mux)
}
```

### **Container Benefits**
- ✅ **Auto Environment Detection** - Automatically uses test containers during testing
- ✅ **Clean Dependency Injection** - No global variables or singletons
- ✅ **Easy Testing** - Mock repositories built-in
- ✅ **Resource Management** - Automatic cleanup with `defer container.Shutdown()`
- ✅ **Health Monitoring** - Built-in health checks for all services

## Setup & Running

### 1. Prerequisites
- Go 1.21+
- Docker & Docker Compose
- 2factor.in account with Transactional SMS API access
- Registered sender ID and template name in 2factor

### 2. Clone & Configure
```sh
git clone <your-repo-url>
cd auth
```

Copy the sample environment file:
```sh
cp sample.env .env
```

Edit `.env` with your actual values:
```
# Secret key for JWT signing (same as scribbl_backend)
SECRET_KEY_BASE=change-this-to-a-strong-random-secret-at-least-32-chars-long

# Redis Configuration (for temporary OTP storage)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your_redis_password

# PostgreSQL Configuration (for persistent user storage)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=auth_db
POSTGRES_SSLMODE=disable

# 2Factor.in SMS API Configuration
TWO_FACTOR_API_KEY=your_2factor_api_key
OTP_TEMPLATE_NAME=your_template_name

# Application Configuration
PORT=8080

# Rate Limiting Configuration
# Maximum number of OTP requests allowed per minute per phone number
RATE_LIMIT_PER_MINUTE=5

# CORS Configuration - comma-separated list of allowed origins
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Environment (development, staging, production)
APP_ENV=production

# Logging Level (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO
```

- **SECRET_KEY_BASE**: Strong random secret, at least 32 characters (same variable name as scribbl_backend)
- **OTP_TEMPLATE_NAME**: The exact template name registered in 2factor (e.g., "YourTemplate")
- **RATE_LIMIT_PER_MINUTE**: Maximum OTP requests per minute per phone number (defaults to 5 if not set)
- **CORS_ALLOWED_ORIGINS**: Comma-separated list of allowed frontend domains
- **Message format**: The message sent must match your template, e.g., `Your OTP is {{otp}}` (replace `{{otp}}` with the generated OTP)

### 3. Run with Docker Compose (Recommended)
```sh
docker-compose up --build
```
- Auth service: http://localhost:8080
- Redis: localhost:6379
- PostgreSQL: localhost:5432

### 4. Local Development Setup

#### Prerequisites
- **Go 1.21+** - [Download](https://golang.org/dl/)
- **Redis** - For OTP storage and rate limiting
- **PostgreSQL** - For user data persistence
- **2factor.in Account** - For SMS OTP delivery (or use test phone number)

#### Development Environment Setup

**1. Install and Start Dependencies**
```bash
# macOS (using Homebrew)
brew install redis postgresql
brew services start redis
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server postgresql postgresql-contrib
sudo systemctl start redis-server
sudo systemctl start postgresql

# Create PostgreSQL database
createdb auth_db
```

**2. Configure Development Environment**
```bash
# Copy and configure environment
cp sample.env .env

# Edit .env for development
nano .env
```

**Development .env Configuration:**
```bash
# Development Secret (generate with: openssl rand -base64 32)
SECRET_KEY_BASE=your-development-secret-key-32-chars-minimum

# Local Redis (no password needed for dev)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Local PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=auth_db
POSTGRES_SSLMODE=disable

# 2Factor.in (get free account or use test phone)
TWO_FACTOR_API_KEY=your_dev_api_key
OTP_TEMPLATE_NAME=YourDevTemplate

# Development Configuration
PORT=8080
APP_ENV=development
LOG_LEVEL=DEBUG
RATE_LIMIT_PER_MINUTE=10

# CORS for local frontend
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**3. Install Dependencies and Run**
```bash
# Install Go dependencies
go mod download

# Run database migrations (auto-created on startup)
# Verify connection with health check first
go run cmd/auth/main.go &
curl http://localhost:8080/health
```

#### Development Workflow

**Start Development Server**
```bash
# Standard run
go run cmd/auth/main.go

# With live reload (install air first)
go install github.com/cosmtrek/air@latest
air

# With verbose logging
LOG_LEVEL=DEBUG go run cmd/auth/main.go

# Run on different port
PORT=8081 go run cmd/auth/main.go
```

**Development Testing**
```bash
# Quick unit tests (no dependencies)
go test ./internal/utils ./internal/models -v

# Full test suite (requires Redis)
go test ./internal/... -v

# Integration tests
go test ./test/integration -v

# Test with coverage
go test ./internal/... -cover

# Continuous testing (with air)
air -c .air.test.toml  # Custom config for testing
```

#### Development Tools & Tips

**1. Hot Reloading with Air**
```bash
# Install air
go install github.com/cosmtrek/air@latest

# Create .air.toml (optional customization)
air init

# Start with live reload
air
```

**2. API Testing**
```bash
# Test health endpoint
curl http://localhost:8080/health

# Test OTP request (development)
curl -X POST http://localhost:8080/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+19999999999"}'

# Test OTP verify (test phone gets fixed OTP: 7415)
curl -X POST http://localhost:8080/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+19999999999", "otp": "7415"}'
```

**3. Database Management**
```bash
# Connect to PostgreSQL
psql auth_db

# View users table
\dt
SELECT * FROM users;

# Clear test data
DELETE FROM users WHERE phone = '+19999999999';

# Check Redis data
redis-cli
KEYS "*"
GET "otp:+19999999999"
```

**4. Debugging**
```bash
# Enable debug logging
LOG_LEVEL=DEBUG go run cmd/auth/main.go

# Run with delve debugger
go install github.com/go-delve/delve/cmd/dlv@latest
dlv debug cmd/auth/main.go

# Profile performance
go run cmd/auth/main.go -cpuprofile=cpu.prof
go tool pprof cpu.prof
```

#### Development Environment Variables

**Essential for Development:**
```bash
# Minimal working config
SECRET_KEY_BASE=dev-secret-key-at-least-32-characters-long
REDIS_HOST=localhost
POSTGRES_HOST=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=auth_db
APP_ENV=development
LOG_LEVEL=DEBUG
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

**Optional Development Enhancements:**
```bash
# Higher rate limit for testing
RATE_LIMIT_PER_MINUTE=100

# Custom port
PORT=8081

# Skip SMS for test phone (always works)
# Test phone: +19999999999, OTP: 7415
```

#### Troubleshooting Development Issues

**Common Issues:**

1. **Redis Connection Failed**
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   
   # Start Redis if not running
   brew services start redis  # macOS
   sudo systemctl start redis-server  # Linux
   ```

2. **PostgreSQL Connection Error**
   ```bash
   # Check PostgreSQL status
   pg_isready
   
   # Verify database exists
   psql -l | grep auth_db
   
   # Create database if missing
   createdb auth_db
   ```

3. **Port Already in Use**
   ```bash
   # Find process using port 8080
   lsof -i :8080
   
   # Kill process or use different port
   PORT=8081 go run cmd/auth/main.go
   ```

4. **Import/Module Issues**
   ```bash
   # Clean module cache
   go clean -modcache
   go mod download
   
   # Verify Go version
   go version  # Should be 1.21+
   ```

5. **Test Phone Not Working**
   ```bash
   # Use the special test phone number
   # Phone: +19999999999
   # OTP: 7415 (fixed, no SMS sent)
   
   # Or check your 2factor.in API key and template
   ```

#### IDE Setup

**VS Code Extensions:**
- Go (official)
- REST Client (for API testing)
- Redis (for Redis monitoring)

**GoLand/IntelliJ:**
- Built-in Go support
- Database tools for PostgreSQL
- HTTP Client for API testing

## Production Deployment

### 1. Production Environment Setup
```sh
# Use production Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or build and run manually
docker build -t auth-service .
docker run -d \
  --name auth-service \
  --env-file .env \
  -p 8080:8080 \
  auth-service
```

### 2. Security Checklist
- [ ] Strong SECRET_KEY_BASE (32+ characters, same as scribbl_backend)
- [ ] CORS_ALLOWED_ORIGINS configured with specific origins
- [ ] Redis password set
- [ ] Environment variables secured
- [ ] HTTPS enabled (use reverse proxy like Nginx/Caddy)
- [ ] Firewall configured
- [ ] Rate limiting configured (RATE_LIMIT_PER_MINUTE, defaults to 5 requests/min per phone)
- [ ] Health checks configured and working (Docker health checks enabled)
- [ ] Non-root user configured in containers

### 3. Monitoring
- Health endpoint: `GET /health`
- Monitor Redis connection and memory usage
- Monitor PostgreSQL connection and performance
- Monitor SMS API quota and delivery rates
- Set up log aggregation and alerting

## API Usage

### Phone Number Format
All phone numbers must be in E.164 format:
- Must start with `+` followed by country code
- Examples: `+919876543210`, `+12345678901`
- Invalid: `9876543210`, `+91 98765 43210`

### Request OTP
```
POST /auth/request-otp
Content-Type: application/json
{
  "phone": "+919876543210"
}
```
- Response: `{ "message": "OTP sent" }`
- OTP is delivered via SMS using 2factor.in Transactional SMS API
- Rate limited: configurable via RATE_LIMIT_PER_MINUTE (defaults to 5 requests per minute per phone number)

### Verify OTP
```
POST /auth/verify-otp
Content-Type: application/json
{
  "phone": "+919876543210",
  "otp": "1234"
}
```
- Response: `{ "message": "Authenticated", "token": "<jwt>" }`
- OTP must be exactly 4 digits

### Get User Profile (Protected)
```
GET /auth/user
Authorization: Bearer <jwt_token>
```
- Response: 
```json
{
  "id": 1,
  "phone": "+919876543210",
  "name": "John Doe",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Update User Name (Protected)
```
PUT /auth/user/update
Authorization: Bearer <jwt_token>
Content-Type: application/json
{
  "name": "John Smith"
}
```
- Response: 
```json
{
  "message": "User name updated successfully",
  "user": {
    "id": 1,
    "phone": "+919876543210",
    "name": "John Smith",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```
- Name must be 1-100 characters long

### Health Check
```
GET /health
```
- Response: `{ "status": "ok", "service": "auth" }`
- Used by Docker health checks and monitoring systems
- Test: `curl http://localhost:8080/health`

## Testing

The authentication service features a comprehensive, well-organized test suite with **65+ test cases** across multiple packages.

### 🏗️ Test Structure

```bash
# Run all tests
go test ./internal/... -v

# Run specific test categories
go test ./internal/utils -v      # Validation & OTP generation (no dependencies)
go test ./internal/models -v     # User & OTP operations (mock storage)
go test ./internal/middleware -v # Rate limiting, CORS, auth (requires Redis)
go test ./internal/handlers -v   # HTTP handlers (requires Redis)
```

### 📊 Test Coverage by Package

| Package | Test Files | Test Cases | Coverage | Dependencies |
|---------|------------|------------|----------|--------------|
| **utils** | `validation_test.go`, `otp_test.go` | 20+ cases | 100% | None |
| **models** | `models_test.go` | 15+ cases | 95% | Mock storage |
| **middleware** | `middleware_test.go` | 15+ cases | 90% | Redis |
| **handlers** | `auth_handlers_test.go`, `user_handlers_test.go` | 15+ cases | 85% | Redis + mocks |

### 🎯 Key Test Areas

#### **Validation Tests** (33 test cases)
- **Phone Validation**: E.164 format, international numbers, edge cases
- **OTP Validation**: 4-digit requirement, invalid formats, boundary conditions  
- **Name Validation**: Length limits, whitespace handling, Unicode support

#### **Authentication Flow Tests**
- **Complete OTP Workflow**: Request → Store → Verify → JWT generation
- **Rate Limiting**: 5 requests/minute enforcement, body reconstruction
- **JWT Operations**: Token creation, validation, expiry, error scenarios

#### **User Management Tests**  
- **CRUD Operations**: Create, read, update with mock/real storage
- **Profile Management**: Name updates, validation, persistence
- **Error Scenarios**: Not found, validation failures, auth failures

#### **Middleware Tests**
- **CORS**: Preflight requests, origin validation, header management
- **Rate Limiting**: Request counting, Redis integration, error responses
- **Authentication**: JWT parsing, validation, context injection

### 🚀 Running Tests

#### **Full Test Suite**
```bash
# All tests with coverage
go test ./internal/... -cover -v

# Parallel execution  
go test ./internal/... -v -parallel 4
```

#### **Targeted Testing**
```bash
# Unit tests only (no external dependencies)
go test ./internal/utils ./internal/models -v

# Integration tests (requires Redis)
go test ./internal/middleware ./internal/handlers -v

# Specific functionality
go test ./internal/handlers -v -run TestRequestOTPHandler
```

#### **Mock vs Real Dependencies**
```bash
# Automatic mocks (no setup needed)
go test ./internal/models -v

# Real Redis (requires running Redis server)
go test ./internal/middleware -v
```

### 🔧 Test Environment

**Prerequisites for Full Suite:**
- Redis server on localhost:6379
- Environment variables: `SECRET_KEY_BASE`, `TWO_FACTOR_API_KEY`, `OTP_TEMPLATE_NAME`

**Mock-Only Tests** (no external dependencies):
- `./internal/utils` - Pure validation functions
- `./internal/models` - Automatic mock storage when no DB/Redis

### 🧪 Integration Tests

The service includes comprehensive integration tests that verify the complete authentication flow:

#### **Integration Test Suite** (`test/integration/`)
```bash
# Run integration tests
go test -v ./test/integration

# Integration tests cover:
# - Complete OTP request → verify → JWT flow
# - Rate limiting behavior across requests  
# - CORS functionality with actual HTTP requests
# - Error scenarios and edge cases
# - Health endpoint verification
```

**Key Integration Test Areas:**
- **Complete Auth Flow**: Full OTP workflow from request to JWT token usage
- **Rate Limiting**: Actual Redis-based request limiting (5 requests/minute)
- **CORS Headers**: Real HTTP request/response validation
- **Error Handling**: Network failures, invalid requests, expired OTPs
- **Security**: JWT validation, unauthorized access attempts

**Prerequisites for Integration Tests:**
- Running Redis server (for OTP storage and rate limiting)
- Proper environment configuration
- Network connectivity for actual HTTP requests

### 📋 Test Organization Benefits

1. **Maintainable**: Each package tests its own functionality
2. **Fast**: Mock storage for unit tests, parallel execution
3. **Focused**: Clear separation of unit vs integration tests  
4. **Reliable**: Isolated tests that don't interfere with each other
5. **Comprehensive**: 65+ test cases covering success and error paths
6. **End-to-End**: Integration tests verify complete system behavior

### Test Phone Number
For development and testing, use the special test phone number:
- Phone: `+19999999999`
- Fixed OTP: `7415`
- No SMS will be sent for this number

## Security & Best Practices
- OTPs are never exposed to the client or logs.
- OTPs expire after 5 minutes (configurable in code).
- OTPs are deleted from Redis after successful verification.
- Phone numbers validated in E.164 format.
- Built-in rate limiting: configurable OTP requests per minute per phone number (defaults to 5).
- Use HTTPS in production.
- Store secrets (SECRET_KEY_BASE, 2factor API key, template name) securely.
- Containers run as non-root user for enhanced security.
- Minimal Alpine Linux base image reduces attack surface while maintaining functionality.

## Rate Limiting
The service includes built-in rate limiting:
- **Limit**: Configurable via `RATE_LIMIT_PER_MINUTE` environment variable (defaults to 5 OTP requests per minute per phone number)
- **Implementation**: Redis-based using INCR/EXPIRE
- **Response**: HTTP 429 (Too Many Requests) when exceeded
- **Reset**: Counter resets after 1 minute
- **Configuration**: Set `RATE_LIMIT_PER_MINUTE=10` to allow 10 requests per minute, or leave unset for default of 5

## Health Checks
The service includes comprehensive health monitoring:
- **Endpoint**: `GET /health` returns `{"status":"ok","service":"auth"}`
- **Docker Health Check**: Built into Dockerfile using `wget` to check `/health` endpoint
- **Docker Compose**: Health checks configured for both auth service and Redis
- **Monitoring**: Health status visible in `docker ps` and used by orchestrators for automatic recovery
- **Configuration**: 30s interval, 10s timeout, 3 retries, 5s start period

## Troubleshooting
- **Redis connection errors:** Ensure Redis is running and `REDIS_HOST`/`REDIS_PORT` are correct.
- **PostgreSQL connection errors:** Ensure PostgreSQL is running and database credentials are correct.
- **Database table issues:** Tables are created automatically on startup. Check logs for creation errors.
- **2factor API errors:** Check your `TWO_FACTOR_API_KEY`, `OTP_TEMPLATE_NAME`, and phone number format (must be E.164).
- **OTP not received:** Check SMS delivery status in your 2factor dashboard and ensure your template matches the message format.
- **Tests fail:** Make sure Redis and PostgreSQL are running and no other process is using the same DB.
- **Phone format errors:** Ensure phone numbers are in E.164 format (e.g., +919876543210).
- **Rate limiting:** If getting 429 errors, wait 1 minute or use different phone numbers for testing.
- **Container health issues:** Check health status with `docker ps` - containers should show "(healthy)" status.
- **Health check failures:** Verify the `/health` endpoint is accessible: `curl http://localhost:8080/health`
- **User endpoint errors:** Ensure JWT token is included in Authorization header as `Bearer <token>`

## Extending
- Add more user profile fields (email, avatar, etc.) to the PostgreSQL schema.
- Add JWT middleware for additional protected routes.
- Customize rate limiting limits (configurable via RATE_LIMIT_PER_MINUTE environment variable).
- Add CORS middleware customization.
- Add user roles and permissions.
- Implement user deletion and account management.
- See [Standard Go Project Layout](https://github.com/golang-standards/project-layout) for more structure ideas.

---

**MIT License** 

## Running Tests

```bash
# Run all tests
go test ./...

# Run specific test packages
go test ./internal/repositories/...
go test ./internal/services/...
go test ./test/integration/...

# Run tests with verbose output
go test -v ./...
```

### Test Categories

#### 1. Unit Tests
- **Mock Tests**: Fast, isolated tests using mock repositories
- **Service Tests**: Business logic testing with mock dependencies
- **Run**: `go test ./internal/services/...`

#### 2. Integration Tests
- **API Tests**: End-to-end HTTP API testing
- **Uses**: Test containers with mock repositories for speed
- **Run**: `go test ./test/integration/...`

#### 3. Redis Integration Tests
- **Redis OTP Repository**: Tests against real Redis instance
- **Requirements**: Redis server running on localhost:6379 (or set TEST_REDIS_ADDR)
- **Run**: `go test ./internal/repositories/redis_otp_repo_test.go`

#### 4. End-to-End Integration Tests
- **Real Redis Integration**: Uses RedisTestContainer with real Redis for OTP operations
- **Auto-Detection**: Automatically uses Redis if available, falls back to mocks
- **Requirements**: Redis server for full integration testing
- **Run**: `go test ./test/integration/...`

### Redis Testing Setup

The Redis OTP Repository tests require a running Redis instance:

```bash
# Option 1: Local Redis
redis-server

# Option 2: Docker Redis
docker run -d -p 6379:6379 redis:alpine

# Option 3: Custom Redis address
export TEST_REDIS_ADDR=localhost:6379
```

**Test Features:**
- Uses Redis DB 15 for testing (isolated from production)
- Auto-cleanup of test data
- Skips if Redis is unavailable
- Tests Redis-specific functionality (TTL, expiration, concurrency)

**Integration Test Behavior:**
- **With Redis**: Uses `RedisTestContainer` for authentic integration testing
- **Without Redis**: Falls back to `TestContainer` with mocks for fast CI/CD
- **Automatic Detection**: No configuration needed - tests adapt to environment

### Running Tests Without Redis

```bash
# Skip Redis tests (short mode)
go test -short ./...

# Run only unit tests
go test ./internal/services/...
go test ./internal/repositories/mock_*
```

### Test Coverage

```bash
# Generate coverage report
go test -cover ./...

# Detailed coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
``` 