'use strict';
// This describes file verification, not a new astronomical algorithm/version.
const SOURCE_VERIFICATION_POLICY = Object.freeze({
  version: 'sha256-stat-fingerprint-v2-scoped-assets',
  initial_verification: 'full_sha256_all_bundle_and_required_source_files',
  each_transaction: 'science_transactions_check_all_required_paths_and_file_fingerprints',
  static_assets: 'after_initial_full_audit_check_manifest_identity_and_requested_registered_serving_file_fingerprint_and_sha_only',
  asset_readiness: 'asset_success_does_not_mark_science_sources_ready',
  fingerprint: ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'],
  unchanged_fingerprint: 'reuse_previously_verified_sha256',
  metadata_change: 'full_sha256_required_before_use',
  comparison_payload: 'raw_sha256_checked_each_read',
  batching: 'simultaneously_queued_transactions_share_one_validation_pass_no_time_ttl',
  full_audit: 'startup_and_node_app_js_verify_sources_and_exact_release_audit',
  deployment_input_contract: 'immutable_read_only_source_files',
  limit: 'A host administrator able to forge file identity and all timestamps is outside this metadata-cache trust boundary.'
});
module.exports = { SOURCE_VERIFICATION_POLICY };
