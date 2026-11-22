pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'rajadmin01'
        IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Images') {
            steps {
                echo "Building Docker images with tag: ${IMAGE_TAG}..."
                sh "docker build -t ${DOCKER_HUB_USER}/careerpilot-backend:${IMAGE_TAG} ./backend"
                sh "docker build -t ${DOCKER_HUB_USER}/careerpilot-frontend:${IMAGE_TAG} ./frontend"
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo "Logging into Docker Hub and pushing images..."
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                    sh 'echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin'
                    sh "docker push ${DOCKER_HUB_USER}/careerpilot-backend:${IMAGE_TAG}"
                    sh "docker push ${DOCKER_HUB_USER}/careerpilot-frontend:${IMAGE_TAG}"
                }
            }
        }
    }
}
