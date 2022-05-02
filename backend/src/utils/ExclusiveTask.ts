export type TaskState = {
    cancelled: boolean;
};

type TaskFunc<T, Arg> = (state: TaskState, arg?: Arg) => Promise<T>;
type WaiterFunc<T> = {resolve: (value: T) => void, reject: (reason?: Error) => void};

export default class ExclusiveTask<T, Arg> {
    private readonly taskFunc: TaskFunc<T, Arg>;
    private running = false;
    private waiters: WaiterFunc<T>[] = [];
    private state: TaskState = { cancelled: false };

    constructor(taskFunc: TaskFunc<T, Arg>) {
        this.taskFunc = taskFunc;
    }

    /**
     * Executes only one instance of task.
     * If task already running, new caller will wait for result of first execution.
     *
     * example:
     * ```
     *   let inc = 0;
     *   const task = new Task(async (state) => {
     *       inc++;
     *       console.log('Start task');
     *       await sleep(1000);
     *       if (state.cancelled) throw new Error('Task cancelled');
     *       console.log('End task');
     *       return inc;
     *   });
     *
     *   task.exclusive().then(r => { console.log('task 1:', r) });
     *   task.exclusive().then(r => { console.log('task 2:', r) });
     * ```
     *
     * should output:
     *   start task
     *   end task
     *   task1: 1
     *   task2: 1
     *
     * @param arg
     */
    async run(arg?: Arg): Promise<T> {
        if (this.running) {
            const newWaiter = (resolve, reject) => {
                this.waiters.push({resolve, reject});
            };
            return await new Promise<T>(newWaiter);
        }
        this.running = true;
        this.state.cancelled = false;

        try {
            const result = await this.taskFunc(this.state, arg);
            this.waiters.forEach(waiter => waiter.resolve(result));
            return result;
        }
        catch (error) {
            this.waiters.forEach(waiter => waiter.reject(error));
            throw error;
        }
        finally {
            this.waiters = [];
            this.running = false;
        }
    }

    async cancel() {
        if (!this.running) {
            return;
        }
        this.state.cancelled = true;
    }
}
