//========================================================================
//
// XpdfApp.cc
//
// Copyright 2015 Glyph & Cog, LLC
//
//========================================================================

#include <aconf.h>

#include <stdlib.h>
#include <stdio.h>
#include <QFileInfo>
#include <QLocalSocket>
#ifdef _WIN32
#  include <shlobj.h>
#endif
#include "config.h"
#include "parseargs.h"
#include "GString.h"
#include "GList.h"
#include "gfile.h"
#include "GlobalParams.h"
#include "XpdfViewer.h"
#include "XpdfApp.h"
#include "gmempp.h"

//------------------------------------------------------------------------
// command line options
//------------------------------------------------------------------------

static GBool openArg = gFalse;
static GBool reverseVideoArg = gFalse;
static char paperColorArg[256] = "";
static char matteColorArg[256] = "";
static char fsMatteColorArg[256] = "";
static char initialZoomArg[256] = "";
static int rotateArg = 0;
static char antialiasArg[16] = "";
static char vectorAntialiasArg[16] = "";
static char textEncArg[128] = "";
static char passwordArg[33] = "";
static GBool fullScreen = gFalse;
static char remoteServerArg[256] = "";
static char tabStateFile[256] = "";
static char cfgFileArg[256] = "";
static GBool printCommandsArg = gFalse;
static GBool printVersionArg = gFalse;
static GBool printHelpArg = gFalse;

static ArgDesc argDesc[] = {
  {"-open",         argFlag,   &openArg,           0,                          "open file using a default remote server"},
  {"-rv",           argFlag,   &reverseVideoArg,   0,                          "reverse video"},
  {"-papercolor",   argString, paperColorArg,      sizeof(paperColorArg),      "color of paper background"},
  {"-mattecolor",   argString, matteColorArg,      sizeof(matteColorArg),      "color of matte background"},
  {"-fsmattecolor", argString, fsMatteColorArg,    sizeof(fsMatteColorArg),    "color of matte background in full-screen mode"},
  {"-z",            argString, initialZoomArg,     sizeof(initialZoomArg),     "initial zoom level (percent, 'page', 'width')"},
  {"-rot",          argInt,    &rotateArg,         0,                          "initial page rotation: 0, 90, 180, or 270"},
  {"-aa",           argString, antialiasArg,       sizeof(antialiasArg),       "enable font anti-aliasing: yes, no"},
  {"-aaVector",     argString, vectorAntialiasArg, sizeof(vectorAntialiasArg), "enable vector anti-aliasing: yes, no"},
  {"-enc",          argString, textEncArg,         sizeof(textEncArg),         "output text encoding name"},
  {"-pw",           argString, passwordArg,        sizeof(passwordArg),        "password (for encrypted files)"},
  {"-fullscreen",   argFlag,   &fullScreen,        0,                          "run in full-screen (presentation) mode"},
  {"-remote",       argString, remoteServerArg,    sizeof(remoteServerArg),    "remote server mode - remaining args are commands"},
  {"-cmd",          argFlag,   &printCommandsArg,  0,                          "print commands as they're executed"},
  {"-tabstate",     argString, tabStateFile,       sizeof(tabStateFile),       "file for saving/loading tab state"},
  {"-cfg",          argString, cfgFileArg,         sizeof(cfgFileArg),         "configuration file to use in place of .xpdfrc"},
  {"-v",            argFlag,   &printVersionArg,   0,                          "print copyright and version info"},
  {"-h",            argFlag,   &printHelpArg,      0,                          "print usage information"},
  {"-help",         argFlag,   &printHelpArg,      0,                          "print usage information"},
  {"--help",        argFlag,   &printHelpArg,      0,                          "print usage information"},
  {"-?",            argFlag,   &printHelpArg,      0,                          "print usage information"},
  {NULL}
};

//------------------------------------------------------------------------
// XpdfApp
//------------------------------------------------------------------------

static void mungeOpenFileName(const char *fileName, GString *cmd);

XpdfApp::XpdfApp(int &argc, char **argv):
  QApplication(argc, argv)
{
  XpdfViewer *viewer;
  QLocalSocket *sock;
  QString sockName;
  const char *fileName, *dest;
  GString *color, *cmd;
  GBool ok;
  int pg, i;

  setApplicationName("XpdfReader");
  setApplicationVersion(xpdfVersion);

  ok = parseArgs(argDesc, &argc, argv);
  if (!ok || printVersionArg || printHelpArg) {
    fprintf(stderr, "xpdf version %s [www.xpdfreader.com]\n", xpdfVersion);
    fprintf(stderr, "%s\n", xpdfCopyright);
    if (!printVersionArg) {
      printUsage("xpdf", "[<PDF-file> [:<page> | +<dest>]] ...", argDesc);
    }
    ::exit(99);
  }

  //--- set up GlobalParams; handle command line arguments
  GlobalParams::defaultTextEncoding = "UCS-2";
  globalParams = new GlobalParams(cfgFileArg);
#ifdef _WIN32
  QString dir = applicationDirPath();
  globalParams->setBaseDir(dir.toLocal8Bit().constData());
  dir += "/t1fonts";
  globalParams->setupBaseFonts(dir.toLocal8Bit().constData());
#else
  globalParams->setupBaseFonts(NULL);
#endif
  if (initialZoomArg[0]) {
    globalParams->setInitialZoom(initialZoomArg);
  }
  reverseVideo = reverseVideoArg;
  if (paperColorArg[0]) {
    paperColor = QColor(paperColorArg);
  } else {
    color = globalParams->getPaperColor();
    paperColor = QColor(color->getCString());
    delete color;
  }
  if (reverseVideo) {
    paperColor = QColor(255 - paperColor.red(),
			255 - paperColor.green(),
			255 - paperColor.blue());
  }
  if (matteColorArg[0]) {
    matteColor = QColor(matteColorArg);
  } else {
    color = globalParams->getMatteColor();
    matteColor = QColor(color->getCString());
    delete color;
  }
  if (fsMatteColorArg[0]) {
    fsMatteColor = QColor(fsMatteColorArg);
  } else {
    color = globalParams->getFullScreenMatteColor();
    fsMatteColor = QColor(color->getCString());
    delete color;
  }
  color = globalParams->getSelectionColor();
  selectionColor = QColor(color->getCString());
  delete color;
  if (antialiasArg[0]) {
    if (!globalParams->setAntialias(antialiasArg)) {
      fprintf(stderr, "Bad '-aa' value on command line\n");
    }
  }
  if (vectorAntialiasArg[0]) {
    if (!globalParams->setVectorAntialias(vectorAntialiasArg)) {
      fprintf(stderr, "Bad '-aaVector' value on command line\n");
    }
  }
  if (textEncArg[0]) {
    globalParams->setTextEncoding(textEncArg);
  }
  if (tabStateFile[0]) {
    globalParams->setTabStateFile(tabStateFile);
  }
  if (printCommandsArg) {
    globalParams->setPrintCommands(gTrue);
  }

  errorEventType = QEvent::registerEventType();

  viewers = new GList();

  //--- remote server mode
  if (remoteServerArg[0]) {
    sock = new QLocalSocket(this);
    sockName = "xpdf_";
    sockName += remoteServerArg;
    sock->connectToServer(sockName, QIODevice::WriteOnly);
    if (sock->waitForConnected(5000)) {
      for (i = 1; i < argc; ++i) {
	sock->write(argv[i]);
	sock->write("\n");
      }
      while (sock->bytesToWrite()) {
	sock->waitForBytesWritten(5000);
      }
      delete sock;
      ::exit(0);
    } else {
      delete sock;
      viewer = newWindow(gFalse, remoteServerArg);
      for (i = 1; i < argc; ++i) {
	viewer->execCmd(argv[i], NULL);
      }
      return;
    }
  }

  //--- default remote server
  if (openArg) {
    sock = new QLocalSocket(this);
    sockName = "xpdf_default";
    sock->connectToServer(sockName, QIODevice::WriteOnly);
    if (sock->waitForConnected(5000)) {
      if (argc >= 2) {
	cmd = new GString("openFileIn(");
	mungeOpenFileName(argv[1], cmd);
	cmd->append(",tab)\nraise\n");
	sock->write(cmd->getCString());
	delete cmd;
	while (sock->bytesToWrite()) {
	  sock->waitForBytesWritten(5000);
	}
      }
      delete sock;
      ::exit(0);
    } else {
      delete sock;
      if (argc >= 2) {
	// on Windows: xpdf.cc converts command line args to UTF-8
	// on Linux: command line args are in the local 8-bit charset
#ifdef _WIN32
	QString qFileName = QString::fromUtf8(argv[1]);
#else
	QString qFileName = QString::fromLocal8Bit(argv[1]);
#endif
	openInNewWindow(qFileName, 1, "", rotateArg, passwordArg,
			fullScreen, "default");
      } else {
	newWindow(fullScreen, "default");
      }
      return;
    }
  }

  //--- load PDF file(s) requested on the command line
  if (argc >= 2) {
    i = 1;
    while (i < argc) {
      pg = -1;
      dest = "";
      if (i+1 < argc && argv[i+1][0] == ':') {
	fileName = argv[i];
	pg = atoi(argv[i+1] + 1);
	i += 2;
      } else if (i+1 < argc && argv[i+1][0] == '+') {
	fileName = argv[i];
	dest = argv[i+1] + 1;
	i += 2;
      } else {
	fileName = argv[i];
	++i;
      }
      // on Windows: xpdf.cc converts command line args to UTF-8
      // on Linux: command line args are in the local 8-bit charset
#ifdef _WIN32
      QString qFileName = QString::fromUtf8(fileName);
#else
      QString qFileName = QString::fromLocal8Bit(fileName);
#endif
      if (viewers->getLength() > 0) {
	ok = ((XpdfViewer *)viewers->get(0))
	         ->openInNewTab(qFileName, pg, dest, rotateArg,
				passwordArg, gFalse);
      } else {
	ok = openInNewWindow(qFileName, pg, dest, rotateArg,
			     passwordArg, fullScreen);
      }
    }
  } else {
    newWindow(fullScreen);
  }
}

// Process the file name for the "-open" flag: convert a relative path
// to absolute, and add escape chars as needed.  Append the modified
// name to [cmd].
static void mungeOpenFileName(const char *fileName, GString *cmd) {
  GString *path = new GString(fileName);
  makePathAbsolute(path);
  for (int i = 0; i < path->getLength(); ++i) {
    char c = path->getChar(i);
    if (c == '(' || c == ')' || c == ',' || c == '\x01') {
      cmd->append('\x01');
    }
    cmd->append(c);
  }
  delete path;
}

XpdfApp::~XpdfApp() {
  delete viewers;
  delete globalParams;
}

int XpdfApp::getNumViewers() {
  return viewers->getLength();
}

XpdfViewer *XpdfApp::newWindow(GBool fullScreen,
			       const char *remoteServerName) {
  XpdfViewer *viewer = new XpdfViewer(this, fullScreen);
  viewers->append(viewer);
  if (remoteServerName) {
    viewer->startRemoteServer(remoteServerName);
  }
  viewer->tweakSize();
  viewer->show();
  return viewer;
}

GBool XpdfApp::openInNewWindow(QString fileName, int page, QString dest,
			       int rotate, QString password, GBool fullScreen,
			       const char *remoteServerName) {
  XpdfViewer *viewer;

  viewer = XpdfViewer::create(this, fileName, page, dest, rotate,
			      password, fullScreen);
  if (!viewer) {
    return gFalse;
  }
  viewers->append(viewer);
  if (remoteServerName) {
    viewer->startRemoteServer(remoteServerName);
  }
  viewer->tweakSize();
  viewer->show();
  return gTrue;
}

void XpdfApp::closeWindowOrQuit(XpdfViewer *viewer) {
  int i;

  viewer->close();
  for (i = 0; i < viewers->getLength(); ++i) {
    if ((XpdfViewer *)viewers->get(i) == viewer) {
      viewers->del(i);
      break;
    }
  }
}

void XpdfApp::quit() {
  XpdfViewer *viewer;

  while (viewers->getLength()) {
    viewer = (XpdfViewer *)viewers->del(0);
    viewer->close();
  }
  QApplication::quit();
}

//------------------------------------------------------------------------

void XpdfApp::startUpdatePagesFile() {
  if (!globalParams->getSavePageNumbers()) {
    return;
  }
  readPagesFile();
  savedPagesFileChanged = gFalse;
}

void XpdfApp::updatePagesFile(const QString &fileName, int pageNumber) {
  if (!globalParams->getSavePageNumbers()) {
    return;
  }
  if (fileName.isEmpty()) {
    return;
  }
  QString canonicalFileName = QFileInfo(fileName).canonicalFilePath();
  if (canonicalFileName.isEmpty()) {
    return;
  }
  XpdfSavedPageNumber s(canonicalFileName, pageNumber);
  for (int i = 0; i < maxSavedPageNumbers; ++i) {
    XpdfSavedPageNumber next = savedPageNumbers[i];
    savedPageNumbers[i] = s;
    if (next.fileName == canonicalFileName) {
      break;
    }
    s = next;
  }
  savedPagesFileChanged = gTrue;
}

void XpdfApp::finishUpdatePagesFile() {
  if (!globalParams->getSavePageNumbers()) {
    return;
  }
  if (savedPagesFileChanged) {
    writePagesFile();
  }
}

int XpdfApp::getSavedPageNumber(const QString &fileName) {
  if (!globalParams->getSavePageNumbers()) {
    return 1;
  }
  readPagesFile();
  QString canonicalFileName = QFileInfo(fileName).canonicalFilePath();
  if (canonicalFileName.isEmpty()) {
    return 1;
  }
  for (int i = 0; i < maxSavedPageNumbers; ++i) {
    if (savedPageNumbers[i].fileName == canonicalFileName) {
      return savedPageNumbers[i].pageNumber;
    }
  }
  return 1;
}

void XpdfApp::readPagesFile() {
  // construct the file name (first time only)
  if (savedPagesFileName.isEmpty()) {
#ifdef _WIN32
    char path[MAX_PATH];
    if (SHGetFolderPath(NULL, CSIDL_APPDATA, NULL,
			SHGFP_TYPE_CURRENT, path) != S_OK) {
      return;
    }
    savedPagesFileName = QString::fromLocal8Bit(path);
    savedPagesFileName.append("/xpdf");
    CreateDirectory(savedPagesFileName.toLocal8Bit().constData(), NULL);
    savedPagesFileName.append("/xpdf.pages");
#else
    GString *path = getHomeDir();
    savedPagesFileName = QString::fromUtf8(path->getCString());
    delete path;
    savedPagesFileName.append("/.xpdf.pages");
#endif
  }

  // no change since last read, so no need to re-read
  if (savedPagesFileTimestamp.isValid() &&
      QFileInfo(savedPagesFileName).lastModified() == savedPagesFileTimestamp) {
    return;
  }

  // mark all entries invalid
  for (int i = 0; i < maxSavedPageNumbers; ++i) {
    savedPageNumbers[i].fileName.clear();
    savedPageNumbers[i].pageNumber = 1;
  }

  // read the file
  FILE *f = openFile(savedPagesFileName.toUtf8().constData(), "rb");
  if (!f) {
    return;
  }
  char buf[1024];
  if (!fgets(buf, sizeof(buf), f) ||
      strcmp(buf, "xpdf.pages-1\n") != 0) {
    fclose(f);
    return;
  }
  int i = 0;
  while (i < maxSavedPageNumbers && fgets(buf, sizeof(buf), f)) {
    int n = (int)strlen(buf);
    if (n > 0 && buf[n-1] == '\n') {
      buf[n-1] = '\0';
    }
    char *p = buf;
    while (*p != ' ' && *p) {
      ++p;
    }
    if (!*p) {
      continue;
    }
    *p++ = '\0';
    savedPageNumbers[i].pageNumber = atoi(buf);
    savedPageNumbers[i].fileName = QString::fromUtf8(p);
    ++i;
  }
  fclose(f);

  // save the timestamp
  savedPagesFileTimestamp = QFileInfo(savedPagesFileName).lastModified();
}

void XpdfApp::writePagesFile() {
  if (savedPagesFileName.isEmpty()) {
    return;
  }
  FILE *f = openFile(savedPagesFileName.toUtf8().constData(), "wb");
  if (!f) {
    return;
  }
  fprintf(f, "xpdf.pages-1\n");
  for (int i = 0; i < maxSavedPageNumbers; ++i) {
    if (!savedPageNumbers[i].fileName.isEmpty()) {
      fprintf(f, "%d %s\n",
	      savedPageNumbers[i].pageNumber,
	      savedPageNumbers[i].fileName.toUtf8().constData());
    }
  }
  fclose(f);
  savedPagesFileTimestamp = QFileInfo(savedPagesFileName).lastModified();
}
