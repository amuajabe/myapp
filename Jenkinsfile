pipeline {
    agent any

    environment {
        S3_BUCKET      = 'myapp-config-bucket-sonali'
        APP_DIR        = '/opt/myapp'
        APP_SERVER_IP  = '172.31.43.241' // App Server's PRIVATE IP
        RELEASE_NAME   = "release-${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout Code') {
    steps {
        git branch: 'main', url: 'https://github.com/amuajabe/myapp.git'
    }
}

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Run Tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Pull Config from S3') {
            steps {
                sh '''
                    mkdir -p config redis-conf
                    aws s3 cp s3://myapp-config-bucket-sonali/app/config/app-config.yml config/app-config.yml
                    aws s3 cp s3://myapp-config-bucket-sonali/app/redis/redis.conf redis-conf/redis.conf
                '''
            }
        }

        stage('Package Artifact') {
            steps {
                sh '''
                    rm -rf build-output && mkdir build-output
                    cp -r node_modules server.js package.json build-output/
                    cp -r config build-output/
                    cp redis-conf/redis.conf build-output/

                    tar -czf app-release.tar.gz -C build-output .
                '''
            }
        }

        stage('Deploy to App Server') {
            steps {
                sshagent(credentials: ['app-server-ssh-key']) {
                    sh '''
                        scp -o StrictHostKeyChecking=no app-release.tar.gz ec2-user@${APP_SERVER_IP}:/tmp/
                        ssh -o StrictHostKeyChecking=no ec2-user@${APP_SERVER_IP} '
                            sudo mkdir -p '"${APP_DIR}"'_new &&
                            sudo tar -xzf /tmp/app-release.tar.gz -C '"${APP_DIR}"'_new &&
                            sudo rm -rf '"${APP_DIR}"'_previous &&
                            sudo cp -r '"${APP_DIR}"' '"${APP_DIR}"'_previous 2>/dev/null || true &&
                            sudo rm -rf '"${APP_DIR}"' &&
                            sudo mv '"${APP_DIR}"'_new '"${APP_DIR}"' &&
                            sudo cp '"${APP_DIR}"'/redis.conf /etc/redis6/redis6.conf &&
                            sudo systemctl restart redis6 &&
                            sudo systemctl restart myapp
                        '
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(credentials: ['app-server-ssh-key']) {
                    script {
                        def result = sh(
                            script: '''
                                ssh -o StrictHostKeyChecking=no ec2-user@${APP_SERVER_IP} '
                                    sleep 3
                                    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
                                '
                            ''',
                            returnStdout: true
                        ).trim()

                        if (result != '200') {
                            error("Health check failed with HTTP status: ${result}")
                        } else {
                            echo "Health check passed (HTTP ${result})"
                        }
                    }
                }
            }
        }
    }

    post {
        failure {
            echo 'Deployment failed or health check did not pass — rolling back to previous release.'
            sshagent(credentials: ['app-server-ssh-key']) {
                sh '''
                    ssh -o StrictHostKeyChecking=no ec2-user@${APP_SERVER_IP} '
                        if [ -d '"${APP_DIR}"'_previous ]; then
                            sudo rm -rf '"${APP_DIR}"' &&
                            sudo mv '"${APP_DIR}"'_previous '"${APP_DIR}"' &&
                            sudo systemctl restart myapp &&
                            echo "Rollback completed."
                        else
                            echo "No previous release found to roll back to."
                        fi
                    '
                '''
            }
            withCredentials([string(credentialsId: 'slack-webhook-url', variable: 'SLACK_URL')]) {
                sh '''
                    curl -X POST -H 'Content-type: application/json' \
                    --data "{\\"text\\":\\"Deployment FAILED for build #${BUILD_NUMBER}. Rolled back to previous release.\\"}" \
                    "$SLACK_URL"
                '''
            }
        }

        success {
            withCredentials([string(credentialsId: 'slack-webhook-url', variable: 'SLACK_URL')]) {
                sh '''
                    curl -X POST -H 'Content-type: application/json' \
                    --data "{\\"text\\":\\"Deployment SUCCESSFUL for build #${BUILD_NUMBER}.\\"}" \
                    "$SLACK_URL"
                '''
            }
        }

        always {
            sh 'rm -rf build-output app-release.tar.gz config redis-conf'
        }
    }
}







