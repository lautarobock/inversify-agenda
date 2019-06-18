import * as Agenda from 'agenda';
import { Container, decorate, injectable } from 'inversify';

export interface AgendaTaskConfig {
    key: string;
    target: any;
}

export interface AgendaTaskCommand {
    execute(job: Agenda.Job<Agenda.JobAttributesData>): Promise<void>;
}

export class InversifyAgendaTasksConfiguration {

    tasks: AgendaTaskConfig[] = [];
    intervals: { [key: string]: string[]; } = {};

    decorateAndRegister(target: any, key: string, ...int: (number | string)[]) {
        decorate(injectable(), target);
        this.tasks.push({ key, target });
        int.forEach(i => {
            this.intervals[i] = this.intervals[i] || [];
            this.intervals[i].push(key);
        });
    }
}

export const inversifyAgendaTasksConfiguration = new InversifyAgendaTasksConfiguration();

export function task(key: string, ...int: (number | string)[]) {
    return (target: any) => {
        inversifyAgendaTasksConfiguration.decorateAndRegister(target, key, ...int);
    };
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
        inversifyAgendaTasksConfiguration.tasks.forEach(task => {
            this.container.bind(task.target).toSelf();
            this.defineTaskService(this.container, this.config.agenda, task.key, task.target);
        });

        this.config.agenda.on('ready', () =>
            Object.keys(inversifyAgendaTasksConfiguration.intervals)
                .map(interval => 
                    this.config.agenda.every(interval, inversifyAgendaTasksConfiguration.intervals[interval])
                )
        );
        return this.config.agenda;
    }

    defineTaskService(
        container: Container,
        agenda: Agenda,
        key: string,
        target: symbol
    ) {
        agenda.define(key, async (job: Agenda.Job<Agenda.JobAttributesData>, done: (err?: Error) => void) => {
            try {
                await (container.get(target) as any).execute(job);
                done();
            } catch (err) {
                done(err);
                this.errorHandlers.forEach(handler => handler(err));
            }
        });
    }
}
