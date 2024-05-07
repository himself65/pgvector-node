import { MikroORM, EntityManager, EntitySchema } from '@mikro-orm/postgresql';
import { VectorType, HalfvecType, BitType, l2Distance, maxInnerProduct, cosineDistance, l1Distance, hammingDistance, jaccardDistance } from 'pgvector/mikro-orm';

test('example', async () => {
  const Item = new EntitySchema({
    name: 'Item',
    tableName: 'mikro_items',
    properties: {
      id: {type: Number, primary: true},
      embedding: {type: VectorType, dimensions: 3, nullable: true},
      half_embedding: {type: HalfvecType, dimensions: 3, nullable: true},
      binary_embedding: {type: BitType, length: 3, nullable: true}
    },
  });

  const orm = await MikroORM.init({
    entities: [Item],
    dbName: 'pgvector_node_test',
    user: process.env['USER']
  });
  const em = orm.em.fork();

  await em.execute('CREATE EXTENSION IF NOT EXISTS vector');

  const generator = orm.getSchemaGenerator();
  await generator.refreshDatabase();

  em.create(Item, {embedding: [1, 1, 1], binary_embedding: '000'});
  em.create(Item, {embedding: [2, 2, 2], binary_embedding: '101'});
  em.create(Item, {embedding: [1, 1, 2], binary_embedding: '111'});
  em.create(Item, {embedding: null});

  // L2 distance
  let items = await em.createQueryBuilder(Item)
    .orderBy({[l2Distance('embedding', [1, 1, 1])]: 'ASC'})
    .limit(5)
    .getResult();
  expect(items.map(v => v.id)).toStrictEqual([1, 3, 2, 4]);
  expect(items[0].embedding).toStrictEqual([1, 1, 1]);
  expect(items[1].embedding).toStrictEqual([1, 1, 2]);
  expect(items[2].embedding).toStrictEqual([2, 2, 2]);

  // max inner product
  items = await em.createQueryBuilder(Item)
    .orderBy({[maxInnerProduct('embedding', [1, 1, 1])]: 'ASC'})
    .limit(5)
    .getResult();
  expect(items.map(v => v.id)).toStrictEqual([2, 3, 1, 4]);

  // cosine distance
  items = await em.createQueryBuilder(Item)
    .orderBy({[cosineDistance('embedding', [1, 1, 1])]: 'ASC'})
    .limit(5)
    .getResult();
  expect(items.map(v => v.id).slice(2)).toStrictEqual([3, 4]);

  // L1 distance
  items = await em.createQueryBuilder(Item)
    .orderBy({[l1Distance('embedding', [1, 1, 1])]: 'ASC'})
    .limit(5)
    .getResult();
  expect(items.map(v => v.id)).toStrictEqual([1, 3, 2, 4]);

  // Hamming distance
  items = await em.createQueryBuilder(Item)
    .orderBy({[hammingDistance('binary_embedding', '101')]: 'ASC'})
    .limit(5)
    .getResult();
  expect(items.map(v => v.id)).toStrictEqual([2, 3, 1, 4]);

  // Jaccard distance
  items = await em.createQueryBuilder(Item)
    .orderBy({[jaccardDistance('binary_embedding', '101')]: 'ASC'})
    .limit(5)
    .getResult();
  expect(items.map(v => v.id)).toStrictEqual([2, 3, 1, 4]);

  orm.close();
});
