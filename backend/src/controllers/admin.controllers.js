export const registerUser = async (req, res) => {
  res.status(201).send({ message: "Admin user created successfully" });
};

//get functions for various records

export const getAllInseminations = async (req, res) => {
  res.status(200).send({ inseminations: [] });
};

export const getAllReInseminations = async (req, res) => {
  res.status(200).send({ reInseminations: [] });
};

export const getAllPregnancyChecks = async (req, res) => {
  res.status(200).send({ pregnancyChecks: [] });
};

export const getAllCalvings = async (req, res) => {
  res.status(200).send({ calvings: [] });
};

//delete functions

export const deleteUser = async (req, res) => {
  res.status(200).send({ message: "User deleted successfully" });
};

export const deleteInsemination = async (req, res) => {
  res.status(200).send({ message: "Insemination record deleted successfully" });
};
