extern crate console;
extern crate indicatif;
extern crate inflector;
extern crate regex;
extern crate progressive;

mod models {
    use regex::Regex;
    use std::cmp::Ordering;
    use std::prelude::*;

    #[derive(Debug, Clone)]
    pub enum TagKind {
        General,
        Station,
        System,
    }

    #[derive(Debug, Clone)]
    pub struct Article {
        pub id: String,
        pub created_at: String,
        pub name: String,
        pub body: String
    }

    impl PartialOrd for Article {
        fn partial_cmp(&self, other: &Article) -> Option<Ordering> {
            self.id.partial_cmp(&other.id)
        }
    }

    impl PartialEq for Article {
        fn eq(&self, other: &Article) -> bool {
            self.id == other.id
        }
    }

    impl Ord for Article {
        fn cmp(&self, other: &Article) -> Ordering {
            self.id.cmp(&other.id)
        }
    }

    impl Eq for Article {

    }

    impl Default for Article {
        fn default() -> Self {
            Self {
                id: String::from(""),
                created_at: String::from(""),
                name: String::from(""),
                body: String::from(""),
            }
        }
    }

    #[derive(Debug, Clone)]
    pub struct Tag {
        pub id: String,
        pub kind: TagKind,
        pub name: String,
    }

    impl PartialOrd for Tag {
        fn partial_cmp(&self, other: &Tag) -> Option<Ordering> {
            self.id.partial_cmp(&other.id)
        }
    }

    impl PartialEq for Tag {
        fn eq(&self, other: &Tag) -> bool {
            self.id == other.id
        }
    }

    impl Ord for Tag {
        fn cmp(&self, other: &Tag) -> Ordering {
            self.id.cmp(&other.id)
        }
    }

    impl Eq for Tag {

    }

    impl Default for Tag {
        fn default() -> Self {
            Self {
                id: String::from(""),
                kind: TagKind::General,
                name: String::from(""),
            }
        }
    }

    #[derive(Debug, Clone)]
    pub enum LineKind {
        Headline,
        SubHeadline,
        SubSubHeadline,
        ListItem,
        SubListItem,
        SubSubListItem,
        Date,
        Text,
        Empty,
    }

    #[derive(Debug, Clone)]
    pub struct Line {
        inner: String,
        pub kind: LineKind,
    }

    impl Line {
        pub fn new(line: String) -> Self {
            let kind = if Self::headline_regex().is_match(&line.trim()) {
                LineKind::Headline
            } else if Self::sub_headline_regex().is_match(&line.trim()) {
                LineKind::SubHeadline
            } else if Self::sub_sub_headline_regex().is_match(&line.trim()) {
                LineKind::SubSubHeadline
            } else if Self::list_item_regex().is_match(&line) {
                LineKind::ListItem
            } else if Self::sub_list_item_regex().is_match(&line) {
                LineKind::SubListItem
            } else if Self::sub_sub_list_item_regex().is_match(&line) {
                LineKind::SubSubListItem
            } else if Self::date_regex().is_match(line.trim()) {
                LineKind::Date
            } else if line.trim().is_empty() {
                LineKind::Empty
            } else {
                LineKind::Text
            };

            Self {
                inner: line,
                kind,
            }
        }

        #[inline]
        pub fn headline_regex() -> Regex {
            Regex::new(r"#{1}[^#]\s*(.+)$").expect("Headline Regex.")
        }

        #[inline]
        pub fn sub_headline_regex() -> Regex {
            Regex::new(r"#{2}[^#]\s*(.+)$").expect("SubHeadline Regex.")
        }

        #[inline]
        pub fn sub_sub_headline_regex() -> Regex {
            Regex::new(r"#{3}[^#]\s*(.+)$").expect("SubSubHeadline Regex.")
        }

        #[inline]
        pub fn list_item_regex() -> Regex {
            Regex::new(r"^\*\s*(.+)$").expect("ListItem Regex.")
        }

        #[inline]
        pub fn sub_list_item_regex() -> Regex {
            Regex::new(r"^\s{4}\*\s*(.+)$").expect("SubListItem Regex.")
        }

        #[inline]
        pub fn sub_sub_list_item_regex() -> Regex {
            Regex::new(r"^\s{8}\*\s*(.+)$").expect("SubSubListItem Regex.")
        }

        #[inline]
        pub fn date_regex() -> Regex {
            Regex::new(r"^(\d{4}-\d{2}-\d{2})$").expect("Date Regex.")
        }

        pub fn value(&self) -> String {
            match self.kind {
                LineKind::Headline => {
                    Self::headline_regex()
                        .captures(self.inner.trim())
                        .expect("headline_regex")
                        .get(1)
                        .expect("headline_regex get(1)")
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::SubHeadline => {
                    Self::sub_headline_regex()
                        .captures(self.inner.trim())
                        .expect("sub_headline_regex")
                        .get(1)
                        .expect("sub_headline_regex get(1)")
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::SubSubHeadline => {
                    Self::sub_sub_headline_regex()
                        .captures(self.inner.trim())
                        .expect("sub_sub_headline_regex")
                        .get(1)
                        .expect("sub_sub_headline_regex get(1)")
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::ListItem => {
                    Self::list_item_regex()
                        .captures(&self.inner)
                        .expect("list_item_regex")
                        .get(1)
                        .expect("list_item_regex get(1)")
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::SubListItem => {
                    Self::sub_list_item_regex()
                        .captures(&self.inner)
                        .expect("sub_list_item_regex")
                        .get(1)
                        .expect("sub_list_item_regex get(1)")
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::SubSubListItem => {
                    Self::sub_sub_list_item_regex()
                        .captures(&self.inner)
                        .expect("sub_sub_list_item_regex")
                        .get(1)
                        .expect("sub_sub_list_item_regex get(1)")
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::Date => {
                    Self::date_regex()
                        .captures(self.inner.trim())
                        .expect(&format!("date_regex for {}", &self.inner))
                        .get(1)
                        .expect(&format!("date_regex get(1) for {}", &self.inner))
                        .as_str()
                        .to_string()
                        .trim()
                        .to_string()
                },
                LineKind::Text => {
                    self.inner.trim().to_string()
                },
                LineKind::Empty => {
                    String::from("")
                },
            }
        }
    }
}

mod traits {
    pub trait Task {
        fn run();
    }
}

mod tasks {
    use super::*;

    pub struct ImportMarkdown;

    impl traits::Task for ImportMarkdown {
        fn run() {
        }
    }
}

mod utils {
    use console::{Term, style, Emoji};
    use indicatif::{ProgressBar, ProgressStyle};

    pub struct Progress {
        outer: Term,
        inner: ProgressBar,
        value: String,
    }

    impl Progress {
        pub fn new(value: &str, size: u64) -> Self {
            let outer = Term::stdout();
            let inner = ProgressBar::new(size);

            inner.set_style({
                ProgressStyle::default_bar()
                    .template("[{elapsed_precise}] {bar:40.cyan/green} {percent}% ({eta_precise}) {msg}")
                    .progress_chars("##-")
            });
            inner.enable_steady_tick(100);

            Self {
                outer,
                inner,
                value: value.to_string(),
            }
        }

        pub fn begin(&self) {
            // self.outer.write_line(&self.value).expect("Write message line to STDOUT");
        }

        pub fn inc(&self, message: &str, size: u64) {
            self.inner.set_message(&format!("{}, {}", self.value, message));
            self.inner.inc(size);
        }

        pub fn end(&self) {
            self.inner.finish_with_message(&self.value);
        }
    }
}

mod markdown {
    use std::collections::BTreeMap;
    use std::fs::{File, metadata};
    use std::io::{self, BufRead, BufReader};
    use std::io::prelude::*;
    use std::env::current_dir;
    use super::*;

    #[derive(Debug, Clone)]
    pub struct Markdown {
        inner: BTreeMap<models::Article, Option<BTreeMap<models::Tag, Option<models::Tag>>>>,
    }

    impl Markdown {
        pub fn new() -> Self {
            Self {
                inner: BTreeMap::new(),
            }
        }

        pub fn run(&self) {
            let mut path = current_dir().expect("Current directory path.");

            path.push("resources");
            path.push("articles.md");

            let file = File::open(&path).expect("File articles.md");
            let reader = BufReader::new(file);
            let file_metadata = metadata(path).expect("File metadata for articles.md");
            let progress_bar = utils::Progress::new("Parsing Articles", file_metadata.len() as u64);
            let mut current_article = models::Article::default();

            progress_bar.begin();

            reader.lines().for_each(|line| {
                let text: String = line.expect("A line of text.");
                let size: u64 = text.len() as u64;
                let line = models::Line::new(text);

                match line.kind {
                    models::LineKind::Headline => {
                        current_article = models::Article::default();
                        current_article.name = line.value();

                        // println!("Headline: {}", line.value());
                        progress_bar.inc("Headline", size);
                    },
                    models::LineKind::SubHeadline => {
                        // println!("SubHeadline: {}", line.value());
                        progress_bar.inc("SubHeadline", size);
                    },
                    models::LineKind::SubSubHeadline => {
                        // println!("SubSubHeadline: {}", line.value());
                        progress_bar.inc("SubSubHeadline", size);
                    },
                    models::LineKind::ListItem => {
                        // println!("ListItem: {}", line.value());
                        progress_bar.inc("ListItem", size);
                    },
                    models::LineKind::SubListItem => {
                        // println!("SubListItem: {}", line.value());
                        progress_bar.inc("SubListItem", size);
                    },
                    models::LineKind::SubSubListItem => {
                        current_article.created_at = line.value();

                        // println!("SubSubListItem: {}", line.value());
                        progress_bar.inc("SubSubListItem", size);
                    },
                    models::LineKind::Date => {
                        // println!("Date: {}", line.value());
                        progress_bar.inc("Date", size);
                    },
                    models::LineKind::Text => {
                        current_article.body = format!("{}\n{}", current_article.body, line.value());

                        // println!("Text: {}", line.value());
                        progress_bar.inc("Text", size);
                    },
                    models::LineKind::Empty => {
                        // println!("Empty: {}", line.value());
                        progress_bar.inc("Empty", size);
                    },
                }
            });

            progress_bar.end();
        }
    }
}

fn main() {
    let markdown = markdown::Markdown::new();

    markdown.run();
}
