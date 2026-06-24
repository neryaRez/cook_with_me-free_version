output "bucket_name" {
  description = "S3 bucket name for the static frontend site."
  value       = aws_s3_bucket.site.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN for the static frontend site."
  value       = aws_s3_bucket.site.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name for the static frontend site."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN."
  value       = aws_cloudfront_distribution.site.arn
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID used for Route 53 alias records."
  value       = aws_cloudfront_distribution.site.hosted_zone_id
}
