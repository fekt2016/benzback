exports.signup = (req, res) => {
  const { fullName, phone, password, passwordConfirm, email } = req.body;
  console.log(fullName, phone, password, passwordConfirm, email);
  //good
  res.send("signup");
};
exports.login = (req, res) => {
  res.send("login");
};
