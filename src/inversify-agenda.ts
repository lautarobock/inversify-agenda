import { Agenda } from 'agenda/es';
import { Container, decorate, injectable } from 'inversify';

export interface AgendaTaskConfig {
    key: string;
    target: any;
    options?: Agenda.JobOptions;
    focus?: boolean;
}

export interface AgendaTaskInterval<T> {
    interval: number | string;
    data: T;
}

export interface AgendaTaskCommand {
    execute(job: Agenda.Job<Agenda.JobAttributesData>): Promise<void>;
}

export class InversifyAgendaTasksConfiguration {

    tasks: AgendaTaskConfig[] = [];
    intervals: { [key: string]: { key: string, data?: any }[]; } = {};

    register(target: any, key: string, options: Agenda.JobOptions, interval: (number | string | AgendaTaskInterval<any>), focus: boolean) {
        this.tasks.push({ key, target, options, focus });        
        if (interval) {
            if (typeof interval === 'string' || typeof interval === 'number') {
                this.intervals[interval] = this.intervals[interval] || [];
                this.intervals[interval].push({ key });
            } else {
                this.intervals[interval.interval] = this.intervals[interval.interval] || [];
                this.intervals[interval.interval].push({
                    data: interval.data,
                    key
                });
            }
        }
    }
}

export const inversifyAgendaTasksConfiguration = new InversifyAgendaTasksConfiguration();

export function task(key: string, int?: (number | string | AgendaTaskInterval<any>) | (number | string | AgendaTaskInterval<any>)[], options?: Agenda.JobOptions, focus?: boolean) {
    return (target: any) => {
        decorate(injectable(), target);
        if (int && Array.isArray(int)) {
            int.forEach((interval, idx) => inversifyAgendaTasksConfiguration.register(target, `${key}.${idx}`, options, interval, focus));
        } else if (int && !Array.isArray(int)) {
            inversifyAgendaTasksConfiguration.register(target, key, options, int, focus);
        } else {
            inversifyAgendaTasksConfiguration.register(target, key, options, undefined, focus);
        }
    };
}

export function ftask(key: string, int?: (number | string | AgendaTaskInterval<any>) | (number | string | AgendaTaskInterval<any>)[], options?: Agenda.JobOptions) {
    return task(key, int, options, true);
}

export function xtask(key: string, int?: (number | string | AgendaTaskInterval<any>) | (number | string | AgendaTaskInterval<any>)[], options?: Agenda.JobOptions) {
    console.log('xtask() // ignoring', key);
}

export class InversifyAgenda {

    errorHandlers: ((err: Error) => void)[] = [];

    constructor(
        private container: Container,
        private config: {
            agenda?: Agenda,
            db?: {
                address: string,
                collection?: string,
                options?: any
            }
        }
    ) {
        if (this.config.agenda && this.config.db) {
            throw new Error('Cannot use agenda instance and db configuration at the same time');
        }
        if (!this.config.agenda && !this.config.db) {
            throw new Error('Yu have to configure agenda or db connection');
        }
        if (this.config.db) {
            this.config.agenda = new Agenda({
                db: {
                    address: this.config.db.address,
                    collection: this.config.db.collection,
                    options: this.config.db.options
                }
            });
        }
        this.container.bind(InversifyAgendaService).toConstantValue(new InversifyAgendaService(this.config.agenda));
    }

    onError(hanlder: (err: Error) => void) {
        this.errorHandlers.push(hanlder);
        return this;
    }

    build() {
        let tasks = inversifyAgendaTasksConfiguration.tasks;
        const focused = inversifyAgendaTasksConfiguration.tasks.filter(t => t.focus);
        if (focused.length) {
            tasks = focused;
        }
        tasks.forEach(task => {
            if (!this.container.isBound(task.target)) {
                this.container.bind(task.target).toSelf();
            }
            this.defineTaskService(this.container, this.config.agenda, task.key, task.target, task.options);
        });

        this.config.agenda.on('ready', () =>
            Object.keys(inversifyAgendaTasksConfiguration.intervals)
                .forEach(interval =>
                    inversifyAgendaTasksConfiguration.intervals[interval]
                        .forEach(d => {
                            console.log('Agenda config every', interval, d.key, d.data);
                            this.config.agenda.every(interval, d.key, d.data);
                        })
                )
        );
        return this.config.agenda;
    }

    defineTaskService(
        container: Container,
        agenda: Agenda,
        key: string,
        target: symbol,
        options: Agenda.JobOptions
    ) {
        const done = async (job: Agenda.Job<Agenda.JobAttributesData>, done: (err?: Error) => void) => {
            try {
                await (container.get(target) as any).execute(job);
                done();
            } catch (err) {
                done(err);
                this.errorHandlers.forEach(handler => handler(err));
            }
        };
        if (options) {
            agenda.define(key, options, done);
        } else {
            agenda.define(key, done);
        }
    }

}

export class InversifyAgendaService {

    constructor(private agenda: Agenda) {}

    now<T extends Agenda.JobAttributesData = Agenda.JobAttributesData>(task: any, data?: T): Promise<Agenda.Job<T>> {
        try {
            let key: string;
            if (typeof task === 'string') {
                key = task;
            } else {
                const t = inversifyAgendaTasksConfiguration.tasks.find(t => t.target === task);
                key = t.key;
            }
            return this.agenda.now(key, data);
        } catch (err) {
            throw new Error('Class is not register as a agenda task');
        }
    }
}