import { InversifyAgenda, AgendaTaskCommand, task } from 'inversify-agenda';
import 'reflect-metadata';
import { Container } from 'inversify';
import { JobAttributesData, Job } from 'agenda';

/**
 * First step, create class for tasks/jobs.
 * It needs to be done before create inversify container.
 * Do not decorate with `injectable()`
 */
@task('task.example', 'every 10 seconds')
export class TaskExample implements AgendaTaskCommand {

    execute(job: Job<JobAttributesData>): Promise<void> {
        return new Promise((resolve) => {
            console.log('This is a job runninng', job.attrs);
            resolve();
        });
    }

}

/**
 * Create container, bind services, daos, etc. 
 */
const container = new Container();

/**
 * Configure, build and run a new InversifyAgenda instance
 */
new InversifyAgenda(container, {
    db: {
        address: 'mongodb://example:example123@ds233258.mlab.com:33258/inversify-agenda-simple-example',
        options: {
        useNewUrlParser: true
        }
    }
})
.onError(err => console.error('WORKER', err))
.build()
.start();