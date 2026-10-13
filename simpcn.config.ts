export default {
  "version": 1,
  "publicBaseUrl": "http://192.168.1.14:9000/simpcn-test/mvp/",
  "root": "apps/web/public",
  "exclude": ["**/.DS_Store"],
  "storage": {
    "provider": "minio",
    "endpoint": "http://192.168.1.14:9000",
    "bucket": "simpcn-test",
    "region": "us-east-1",
    "prefix": "mvp"
  },
  "stateFile": ".simpcn/minio-state.json",
  "manifestFile": ".simpcn/manifest.json"
};
