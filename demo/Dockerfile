FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
# Copy built JAR from target folder (run 'mvn clean package' locally first)
COPY target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]