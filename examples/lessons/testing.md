# Testing Lessons

### Test Data `[testing]` `[api]`
- **Use factories, not fixtures**: Hard-coded fixtures break when schema changes. Use factory functions
- **Clean up test data after each test**: Leftover data causes flaky tests in CI

### Mocking `[testing]` `[mock]`
- **Mock at the boundary, not the internals**: Mock HTTP calls, not internal functions
- **Verify mock was called correctly**: `assert_called_with()` catches silent failures
- **Reset mocks between tests**: Shared mock state causes order-dependent test failures

### CI/CD `[testing]` `[ci]`
- **Run tests in parallel only if independent**: Shared database = serial execution required
- **Fail fast on lint errors**: Don't waste CI minutes running tests if lint fails
