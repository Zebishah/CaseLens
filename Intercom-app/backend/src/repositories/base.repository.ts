export interface BaseRepository<TModel, TCreate, TUpdate = Partial<TCreate>> {
  findAll(): Promise<TModel[]>;
  findById(id: number): Promise<TModel | undefined>;
  create(payload: TCreate): Promise<TModel>;
  updateById(id: number, payload: TUpdate): Promise<TModel | undefined>;
  deleteById(id: number): Promise<TModel | undefined>;
}
