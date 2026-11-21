-- Deletes everything core team selection stored: applicants, notes, contact logs, logins.
-- This cannot be undone. Export anything you want to keep from the selection page first.
drop table if exists sel_activity;
drop table if exists sel_applications;
drop table if exists sel_logins;
drop table if exists sel_settings;
drop table if exists sel_imports;
