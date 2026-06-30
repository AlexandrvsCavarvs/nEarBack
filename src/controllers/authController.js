const { asyncHandler } = require('../utils/asyncHandler');
const authService = require('../services/authService');
const { signUpSchema, signInSchema, refreshSchema } = require('../validators/authValidators');

const signUp = asyncHandler(async (req, res) => {
  const payload = signUpSchema.parse(req.body);
  const result = await authService.signUp(payload);
  res.status(201).json(result);
});

const signIn = asyncHandler(async (req, res) => {
  const payload = signInSchema.parse(req.body);
  const result = await authService.signIn(payload);
  res.json(result);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const session = await authService.refreshSession(refreshToken);
  res.json({ session });
});

const signOut = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    await authService.signOut(token);
  }
  res.json({ signedOut: true });
});

module.exports = { signUp, signIn, refresh, signOut };