# Go Auth Service (Phone + OTP)

A minimal, production-ready authentication service in Go using phone number and OTP (One-Time Password) for signup and login. Features JWT token issuance, Redis for storage, 2factor.in Transactional SMS API for OTP delivery, and built-in rate limiting. OTP verification is handled securely in your backend. Follows modern Go project structure best practices.

## Features
- Passwordless authentication (phone + OTP)
- Unified signup/login flow
- JWT token issuance
- Redis for OTP and user storage
- 2factor.in Transactional SMS API for SMS delivery (verification handled in backend)
- Built-in rate limiting (configurable, defaults to 5 requests per minute per phone number)
- E.164 phone number format validation
- Environment variable and `.env` support
- Docker and Docker Compose for local development
- Modular, idiomatic Go project structure
- Automated tests for core auth flow and edge cases
- Test phone number support for development

## How it works
- The backend generates a 4-digit OTP.
- The OTP is sent to the user's phone via 2factor.in's Transactional SMS API (`ADDON_SERVICES/SEND/TSMS`).
- The OTP and expiry are stored in Redis (keyed by phone number).
- When the user submits the OTP, the backend validates the format (must be exactly 4 digits) and checks against Redis.
- Phone numbers must be in E.164 format (e.g., +919876543210).
- Built-in rate limiting prevents abuse (configurable via RATE_LIMIT_PER_MINUTE, defaults to 5 OTP requests per minute per phone number).
- On success, a JWT token is issued.

## Project Structure
```
cmd/
  auth/
    main.go           # Application entry point
internal/
  handlers/           # HTTP handlers
    auth.go
    auth_test.go
  models/             # User and OTP/session models, business logic
    user.go
  storage/            # Redis client
    redis.go
  utils/              # Utilities (OTP generation, 2factor integration)
    otp.go
  middleware/         # Shared middleware (CORS, rate limiting)
    cors.go
    ratelimit.go
Dockerfile
README.md
.env (not committed)
docker-compose.yml
go.mod
go.sum
```

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

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your_redis_password

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

### 4. Run Locally (Dev)
```sh
go run cmd/auth/main.go
```

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

### Health Check
```
GET /health
```
- Response: `{ "status": "ok", "service": "auth" }`
- Used by Docker health checks and monitoring systems
- Test: `curl http://localhost:8080/health`

## Testing

### Test Phone Number
For development and testing, use the special test phone number:
- Phone: `+19999999999`
- Fixed OTP: `7415`
- No SMS will be sent for this number

### Run Automated Tests
```sh
go test ./internal/handlers
```

Tests cover:
- Valid OTP flow
- Invalid OTP
- Expired OTP
- Missing fields
- Rate limiting
- CORS preflight
- Multiple users
- Replay attack
- Malformed JSON
- Empty phone
- JWT claims
- Phone format validation

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
- **2factor API errors:** Check your `TWO_FACTOR_API_KEY`, `OTP_TEMPLATE_NAME`, and phone number format (must be E.164).
- **OTP not received:** Check SMS delivery status in your 2factor dashboard and ensure your template matches the message format.
- **Tests fail:** Make sure Redis is running and no other process is using the same DB.
- **Phone format errors:** Ensure phone numbers are in E.164 format (e.g., +919876543210).
- **Rate limiting:** If getting 429 errors, wait 1 minute or use different phone numbers for testing.
- **Container health issues:** Check health status with `docker ps` - containers should show "(healthy)" status.
- **Health check failures:** Verify the `/health` endpoint is accessible: `curl http://localhost:8080/health`

## Extending
- Add JWT middleware for protected routes.
- Customize rate limiting limits (configurable via RATE_LIMIT_PER_MINUTE environment variable).
- Add CORS middleware customization.
- Use persistent user storage (e.g., PostgreSQL) for production.
- See [Standard Go Project Layout](https://github.com/golang-standards/project-layout) for more structure ideas.

---

**MIT License** 