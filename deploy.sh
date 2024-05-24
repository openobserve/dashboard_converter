#!/bin/sh

npm run generate

# Move the files to S3 bucket for hosting
aws s3 sync ./.output/public s3://dashboard-converter/  --exclude=".git/*" --profile=prod

# invalidate cloudfront cache so that latest files can be served
aws cloudfront create-invalidation --distribution-id ECA4Q6I4IIBLU --paths="/*" --profile=prod
