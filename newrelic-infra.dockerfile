FROM newrelic/infrastructure:latest 
ADD newrelic-infra.yml /etc/newrelic-infra.yml 

ENV NEW_RELIC_NO_CONFIG_FILE=true \
    NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true \
    NEW_RELIC_LOG=stdout \
    NEW_RELIC_DISPLAY_NAME=weave_production