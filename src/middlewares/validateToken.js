const process = require('process');
const env = process.env;
const jwt = require('jsonwebtoken');

exports.validateToken = (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (token == null) {
      return res.status(401).json({ message: "Token not provide" });
    } else {
      const tokenWithoutBearer = token.split(" ")[1];
      jwt.verify(tokenWithoutBearer, env.SECRET_KEY, (err, user) => {
        if (err) {
          return res.status(403).json({ message: "Token not valid" });
        }
        req.user = user;
        next();
      });
    }
  } catch (error) {
    return res.status(403).json({ message: "No authorized" });
  }

};