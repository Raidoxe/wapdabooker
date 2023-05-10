import chalk from "chalk";

export const info = (string: string) => console.log(chalk.blue(string));
export const error = (string: string) => console.error(chalk.bold.red(string));
export const inputError = (string: string) => console.log(chalk.red(string));
export const success = (string: string) => console.log(chalk.green(string));
