import child_process from 'child_process';

class Deployer {
  readonly processType: string = 'web';

  constructor(readonly herokuAppName: string) {
  }

  get containerTag() {
    return `registry.heroku.com/${this.herokuAppName}/${this.processType}`;
  }

  private runSync(cmdline: string) {
    console.log(`$ ${cmdline}`)
    child_process.execSync(cmdline, {stdio: 'inherit'});
  }

  loginToRegistry() {
    this.runSync(`heroku container:login`);
    return this;
  }

  pullFromRegistry() {
    this.runSync(`docker pull ${this.containerTag}`);
    return this;
  }

  pushToRegistry() {
    this.runSync(`docker push ${this.containerTag}`);
    return this;
  }

  buildContainer() {
    this.runSync(`docker build --cache-from ${this.containerTag}:latest -t ${this.containerTag} .`);
    return this;
  }

  releaseContainer() {
    this.runSync(`heroku container:release -a ${this.herokuAppName} ${this.processType}`);
    return this;
  }
}

if (!module.parent) {
  const herokuAppName = process.argv[2];

  if (!herokuAppName) {
    console.log(`usage: deploy-to-heroku <heroku app name>`);
    process.exit(1);
  }

  const deployer = new Deployer(herokuAppName);

  deployer
    .loginToRegistry()
    .pullFromRegistry()
    .buildContainer()
    .pushToRegistry()
    .releaseContainer();
}
