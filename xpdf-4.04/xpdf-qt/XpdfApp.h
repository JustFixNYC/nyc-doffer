//========================================================================
//
// XpdfApp.h
//
// Copyright 2015 Glyph & Cog, LLC
//
//========================================================================

#ifndef XPDFAPP_H
#define XPDFAPP_H

#include <aconf.h>

#include <QApplication>
#include <QColor>
#include <QDateTime>
#include "gtypes.h"

class GList;
class XpdfViewer;

//------------------------------------------------------------------------

struct XpdfSavedPageNumber {
  XpdfSavedPageNumber(): pageNumber(1) {}
  XpdfSavedPageNumber(const QString &fileNameA, int pageNumberA)
    : fileName(fileNameA), pageNumber(pageNumberA) {}
  QString fileName;
  int pageNumber;
};

#define maxSavedPageNumbers 100

//------------------------------------------------------------------------
// XpdfApp
//------------------------------------------------------------------------

class XpdfApp: public QApplication {
  Q_OBJECT

public:

  XpdfApp(int &argc, char **argv);
  virtual ~XpdfApp();

  int getNumViewers();

  XpdfViewer *newWindow(GBool fullScreen = gFalse,
			const char *remoteServerName = NULL);

  GBool openInNewWindow(QString fileName, int page = 1,
			QString dest = QString(),
			int rotate = 0,
			QString password = QString(),
			GBool fullScreen = gFalse,
			const char *remoteServerName = NULL);

  void closeWindowOrQuit(XpdfViewer *viewer);

  // Called just before closing one or more PDF files.
  void startUpdatePagesFile();
  void updatePagesFile(const QString &fileName, int pageNumber);
  void finishUpdatePagesFile();

  // Return the saved page number for [fileName].
  int getSavedPageNumber(const QString &fileName);

  void quit();

  //--- for use by XpdfViewer

  int getErrorEventType() { return errorEventType; }
  const QColor &getPaperColor() { return paperColor; }
  const QColor &getMatteColor() { return matteColor; }
  const QColor &getFullScreenMatteColor() { return fsMatteColor; }
  const QColor &getSelectionColor() { return selectionColor; }
  GBool getReverseVideo() { return reverseVideo; }

private:

  void readPagesFile();
  void writePagesFile();

  int errorEventType;
  QColor paperColor;
  QColor matteColor;
  QColor fsMatteColor;
  QColor selectionColor;
  GBool reverseVideo;

  GList *viewers;		// [XpdfViewer]

  QString savedPagesFileName;
  QDateTime savedPagesFileTimestamp;
  XpdfSavedPageNumber savedPageNumbers[maxSavedPageNumbers];
  GBool savedPagesFileChanged;
};

#endif
