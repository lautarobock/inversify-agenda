import * as Agenda from 'agenda';
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

    decorateAndRegister(target: any, key: string, options: Agenda.JobOptions, intervals: (number | string | AgendaTaskInterval<any>)[], focus: boolean) {
        decorate(injectable(), target);
        this.tasks.push({ key, target, options, focus });
        intervals.forEach(interval => {
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
        });
    }
}

export const inversifyAgendaTasksConfiguration = new InversifyAgendaTasksConfiguration();

export function task(key: string, int: (number | string | AgendaTaskInterval<any>) | (number | string | AgendaTaskInterval<any>)[], options?: Agenda.JobOptions, focus?: boolean) {
    return (target: any) => {
        if (Array.isArray(int)) {
            inversifyAgendaTasksConfiguration.decorateAndRegister(target, key, options, int, focus);
        } else {
            inversifyAgendaTasksConfiguration.decorateAndRegister(target, key, options, [int], focus);
        }
    };
}

export function ftask(key: string, int: (number | string | AgendaTaskInterval<any>) | (number | string | AgendaTaskInterval<any>)[], options?: Agenda.JobOptions) {
    return task(key, int, options);
}

export function xtask(key: string, int: (number | string | AgendaTaskInterval<any>) | (number | string | AgendaTaskInterval<any>)[], options?: Agenda.JobOptions) {
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
            this.container.bind(task.target).toSelf();
            this.defineTaskService(this.container, this.config.agenda, task.key, task.target, task.options);
        });

        this.config.agenda.on('ready', () =>
            Object.keys(inversifyAgendaTasksConfiguration.intervals)
                .forEach(interval =>
                    inversifyAgendaTasksConfiguration.intervals[interval]
                        .forEach(d => this.config.agenda.every(interval, d.key, d.data))
                )
        );
        this.container.bind(InversifyAgendaService).toConstantValue(new InversifyAgendaService(this.config.agenda));
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

    now<T extends Agenda.JobAttributesData = Agenda.JobAttributesData>(name: string, data?: T): Promise<Agenda.Job<T>> {
        return this.agenda.now(name, data);
    }
}