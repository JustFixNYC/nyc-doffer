import child_process from 'child_process';
import { CommandLineParser, CommandLineStringParameter, CommandLineAction, CommandLineFlagParameter } from '@microsoft/ts-command-line';

class DeployToHeroku extends CommandLineAction {
  private _appName?: CommandLineStringParameter;
  private _ignoreCache?: CommandLineFlagParameter;

  constructor() {
    super({
      actionName: 'deploy',
      summary: 'Deploy the app to Heroku.',
      documentation: 'This command builds the app container and deploys it to Heroku.'
    });
  }

  protected onDefineParameters() {
    this._appName = this.defineStringParameter({
      parameterShortName: '-a',
      parameterLongName: '--app',
      argumentName: 'APP_NAME',
      description: 'The Heroku app name to deploy to.',
      required: true
    });

    this._ignoreCache = this.defineFlagParameter({
      parameterLongName: '--ignore-cache',
      description: 'Do not pull existing container image or use it as a cache.'
    });
  }

  protected async onExecute() {
    const appName = (this._appName && this._appName.value) || '';
    const ignoreCache = this._ignoreCache && this._ignoreCache.value;

    const heroku = new HerokuDeployer(appName);

    heroku.loginToRegistry();
    if (ignoreCache) {
      heroku.docker.build().push();
    } else {
      heroku.docker
        .pull()
        .build(`${heroku.containerTag}:latest`)
        .push();
    }
    heroku.releaseContainer();
  }
}

class DeployerCommandLine extends CommandLineParser {
  constructor() {
    super({
      toolFilename: 'deployer',
      toolDescription: 'Build and/or deploy nyc-doffer.'
    });

    this.addAction(new DeployToHeroku());
  }

  protected onDefineParameters() {
  }
}

class DockerBuilder {
  constructor(readonly containerTag: string) {
  }

  pull() {
    runSync(`docker pull ${this.containerTag}`);
    return this;
  }

  push() {
    runSync(`docker push ${this.containerTag}`);
    return this;
  }

  build(cacheFrom?: string) {
    const cacheFromArg = cacheFrom ? `--cache-from ${cacheFrom}` : ``;
    runSync(`docker build ${cacheFromArg} -t ${this.containerTag} .`);
    return this;
  }
}

class HerokuDeployer {
  readonly processType: string = 'web';
  readonly docker: DockerBuilder;

  constructor(readonly herokuAppName: string) {
    this.docker = new DockerBuilder(this.containerTag);
  }

  get containerTag() {
    return `registry.heroku.com/${this.herokuAppName}/${this.processType}`;
  }

  loginToRegistry() {
    runSync(`heroku container:login`);
    return this;
  }

  releaseContainer() {
    runSync(`heroku container:release -a ${this.herokuAppName} ${this.processType}`);
    return this;
  }
}

function runSync(cmdline: string) {
  console.log(`$ ${cmdline}`)
  child_process.execSync(cmdline, {stdio: 'inherit'});
}

if (!module.parent) {
  (new DeployerCommandLine()).execute();
}
