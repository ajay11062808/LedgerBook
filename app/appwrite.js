import { Client, Account, ID, Databases,Query } from 'react-native-appwrite';

const config = {
  endpoint: 'https://cloud.appwrite.io/v1',
  platform: 'com.ravi.ledgerbook',
  projectId: '674beb99002624b2878a',
  databaseId: '674bfb6f002b0cf2318e',
  loansCollectionId: '674bfb910029ff56a7a1',
  landActivitiesCollectionId: '674d808b00204dc07c32'
};

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setPlatform(config.platform);

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases, config, ID ,Query};