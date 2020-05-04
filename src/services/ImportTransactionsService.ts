import { getCustomRepository, In, getRepository } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

import AppError from '../errors/AppError';

interface RequestDTO {
  csvRows: string[];
}

type TransactionTypes = 'income' | 'outcome';
interface CsvTransaction {
  title: string;
  type: TransactionTypes;
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ csvRows }: RequestDTO): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const csvRowsWithoutBlanks = csvRows.filter(Boolean);

    const [, ...csvTransactionsRows] = csvRowsWithoutBlanks;

    if (csvTransactionsRows.length < 1) {
      throw new AppError('No transactions found in the file');
    }

    const transactions: CsvTransaction[] = [];
    const categories: string[] = [];

    csvTransactionsRows.forEach(row => {
      const [title, type, value, category] = row
        .split(',')
        .map(cell => cell.trim());

      if (!['income', 'outcome'].includes(type)) {
        throw new AppError('Invalid transaction type');
      }

      if (!title || !value || !category) {
        throw new AppError('One or more transactions are missing data');
      }

      const tempTransaction = {
        title,
        type: type as TransactionTypes,
        value: Number(value),
        category,
      };

      console.log(tempTransaction);

      transactions.push(tempTransaction);

      categories.push(category);
    });

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const categoriesToBeCreated = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((category, index, self) => self.indexOf(category) === index);

    const newCategories = categoriesRepository.create(
      categoriesToBeCreated.map(title => ({
        title,
      })),
    );

    const createdCategories = await categoriesRepository.save(newCategories);

    const allCsvCategories = [...createdCategories, ...existentCategories];

    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCsvCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    const createdTransactions = await transactionsRepository.save(
      newTransactions,
    );

    return createdTransactions;
  }
}

export default ImportTransactionsService;
