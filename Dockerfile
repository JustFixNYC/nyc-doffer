FROM node:12.10.0

ARG XPDF_VERSION=4.02

# https://github.com/Googlechrome/puppeteer/issues/290#issuecomment-322838700
RUN apt-get update && apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6\
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
  && rm -rf /var/lib/apt/lists/*

RUN curl https://xpdfreader-dl.s3.amazonaws.com/xpdf-tools-linux-${XPDF_VERSION}.tar.gz > /xpdf.tar.gz \
  && tar -zxvf /xpdf.tar.gz \
  && cp xpdf-tools-linux-${XPDF_VERSION}/bin64/pdftotext /bin \
  && rm -rf xpdf-tools-linux-${XPDF_VERSION} \
  && rm /xpdf.tar.gz

WORKDIR /nyc-doffer

RUN groupadd -g 999 doffer \
  && useradd -m -r -u 999 -g doffer doffer \
  && chown doffer:doffer /nyc-doffer

USER doffer

COPY --chown=doffer:doffer package.json yarn.lock /nyc-doffer/

RUN yarn --frozen-lockfile --no-cache

COPY --chown=doffer:doffer . /nyc-doffer/

RUN yarn build

# We're only visiting the DOF site, which we trust, so we'll just
# disable the Chromium sandbox.
ENV DISABLE_CHROMIUM_SANDBOX=1

CMD ["node", "-r", "esm", "webapp.js"]
