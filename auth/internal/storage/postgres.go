package storage

import (
	"database/sql"
	"fmt"
	"log"
	"sync"

	"auth/internal/config"
	_ "github.com/lib/pq"
)

var (
	DB     *sql.DB
	dbOnce sync.Once
)

func InitPostgres() {
	dbOnce.Do(func() {
		dbConfig := config.GetDatabaseConfig()
		poolConfig := config.GetPoolConfig()

		psqlInfo := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			dbConfig.Host, dbConfig.Port, dbConfig.User, dbConfig.Password, dbConfig.DBName, dbConfig.SSLMode)

		var err error
		DB, err = sql.Open("postgres", psqlInfo)
		if err != nil {
			log.Fatalf("Failed to open database connection: %v", err)
		}

		// Test connection
		err = DB.Ping()
		if err != nil {
			log.Fatalf("Failed to ping database: %v", err)
		}

		// Set connection pool settings
		DB.SetMaxOpenConns(poolConfig.MaxOpenConns)
		DB.SetMaxIdleConns(poolConfig.MaxIdleConns)
		DB.SetConnMaxLifetime(poolConfig.ConnMaxLifetime)

		log.Printf("Successfully connected to PostgreSQL at %s:%s", dbConfig.Host, dbConfig.Port)

		// Create tables if they don't exist
		createTables()
	})
}

func createTables() {
	// Create users table
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		phone VARCHAR(20) UNIQUE NOT NULL,
		name VARCHAR(100),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	_, err := DB.Exec(createUsersTable)
	if err != nil {
		log.Fatalf("Failed to create users table: %v", err)
	}

	log.Println("Database tables created/verified successfully")
}
