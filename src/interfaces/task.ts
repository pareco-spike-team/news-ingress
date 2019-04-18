export default interface Task {
  run(): Promise<unknown>;
}
