// The legacy Clerk proxy creates a fresh client on every property read when
// no secret key is configured. Keep test doubles on one in-process client.
process.env.CLERK_SECRET_KEY = "sk_test_breedsmart_fixture_only";
