#!/usr/bin/env bash
set -euo pipefail

echo "---- makesoft: automated backend run helper ----"

# Check Java
if ! command -v java >/dev/null 2>&1; then
  echo "Java not found. Attempting to install openjdk@17 via Homebrew..."
  if command -v brew >/dev/null 2>&1; then
    brew install openjdk@17
    echo "If brew printed instructions about PATH, follow them and re-run this script. Exiting now." 
    exit 0
  else
    echo "Homebrew not found. Please install Java 17 (OpenJDK) and re-run."
    exit 1
  fi
fi

# Check Maven
if ! command -v mvn >/dev/null 2>&1; then
  echo "Maven not found. Attempting to install maven via Homebrew..."
  if command -v brew >/dev/null 2>&1; then
    brew install maven
  else
    echo "Homebrew not found. Please install Maven and re-run."
    exit 1
  fi
fi

echo "Java and Maven are available. Preparing to run backend."

# Force Java 17 (project requirement)
export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home)"
export PATH="$JAVA_HOME/bin:$PATH"
echo "Using Java from: $JAVA_HOME"
java -version

cd "$(dirname "$0")/.." || exit 1
cd backend-api || exit 1

# Create mvnw wrapper if missing (this requires mvn to exist)
if [ ! -x ./mvnw ]; then
  echo "Creating Maven wrapper (mvn -N io.takari:maven:wrapper)..."
  mvn -N io.takari:maven:wrapper
fi

echo "Starting Spring Boot application (skip tests)..."
./mvnw -DskipTests spring-boot:run
